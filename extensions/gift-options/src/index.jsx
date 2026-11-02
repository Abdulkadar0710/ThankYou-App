/* global globalThis */
/* eslint react/prop-types: off */
import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useRef, useState} from 'preact/hooks';
import {fetchActiveBlock} from '../../shared/blocks';
import {claimExtensionRender} from '../../shared/render-once';
import {limitText, trimText} from '../../shared/text';
import {apiUrls} from '../../shared/app-config';
import {fetchWithTimeout} from '../../shared/fetch-with-timeout';
import {trackClick} from '../../shared/analytics';

const GIFT_WRAP_KEY = 'Gift wrap';
const GIFT_MESSAGE_KEY = 'Gift message';
const GIFT_MESSAGE_SAVE_DELAY_MS = 600;

export default () => {
  try {
    if (!claimExtensionRender('gift-options')) return;

    render(<Extension />, document.body);
  } catch (error) {
    console.error('Gift options failed to render:', error);
  }
};

function Extension() {
  const api = extensionApi();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Gift wrap variant picker state
  const [variants, setVariants] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [productImage, setProductImage] = useState(null);
  const [selectedType, setSelectedType] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [addingToCart, setAddingToCart] = useState(false);
  const [removingFromCart, setRemovingFromCart] = useState(false);
  const [addedVariantTitle, setAddedVariantTitle] = useState('');
  const [cartError, setCartError] = useState('');

  // Live cart lines — used to find & remove the existing gift wrap line
  const cartLines = useSignalValue(api?.lines) || [];

  const giftWrapVariantIds = new Set(variants.map((v) => v.id));
  const existingGiftLine = cartLines.find((line) =>
    giftWrapVariantIds.has(line?.merchandise?.id),
  );
  const inCartVariantId = existingGiftLine?.merchandise?.id;
  const inCartVariant = variants.find((v) => v.id === inCartVariantId);
  const isInCart = Boolean(existingGiftLine);
  const isDifferentFromCart = Boolean(
    isInCart && selectedVariantId && selectedVariantId !== inCartVariantId,
  );

  const attributes = useSignalValue(api?.attributes) || [];
  const giftWrapValue = attributeValue(attributes, GIFT_WRAP_KEY) === 'Yes';
  const giftMessageValue = attributeValue(attributes, GIFT_MESSAGE_KEY);
  const [giftMessageDraft, setGiftMessageDraft] = useState(giftMessageValue);
  const giftMessageDraftRef = useRef(giftMessageValue);
  const giftMessagePendingRef = useRef(false);
  const giftMessageSaveTimerRef =
    /** @type {{current: ReturnType<typeof setTimeout> | null}} */ (
      useRef(null)
    );

  useEffect(() => {
    let mounted = true;

    async function loadBlock() {
      try {
        const block = await fetchActiveBlock('giftOptions');

        if (mounted) setConfig(block?.config || null);
      } catch (loadError) {
        console.error(loadError);

        if (mounted) setConfig(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadBlock();

    return () => {
      mounted = false;
    };
  }, []);

  // Fetch gift wrap variants when the checkbox is checked
  useEffect(() => {
    if (!giftWrapValue) {
      setAddedToCart(false);
      setAddedVariantTitle('');
      setCartError('');
      return;
    }

    if (variants.length > 0) return; // already loaded

    setVariantsLoading(true);

    const shop = shopDomain();

    async function loadVariants() {
      const errors = [];
      for (const baseUrl of apiUrls('/api/gift-wrap-variants')) {
        const url = shop ? `${baseUrl}?shop=${encodeURIComponent(shop)}` : baseUrl;
        try {
          const res = await fetchWithTimeout(url, {method: 'GET'});
          const data = await res.json().catch(() => null);
          if (data?.success && Array.isArray(data.variants)) {
            setVariants(data.variants);
            if (Array.isArray(data.options)) {
              setProductOptions(data.options);
              const typeValues = data.options[0]?.values || [];
              const colorValues = data.options[1]?.values || [];
              if (typeValues.length > 0) setSelectedType(typeValues[0]);
              if (colorValues.length > 0) setSelectedColor(colorValues[0]);
            }
            if (data.productImage) {
              setProductImage(data.productImage);
            }
            if (data.variants.length > 0) {
              setSelectedVariantId(data.variants[0].id);
            }
            setVariantsLoading(false);
            return;
          }
          errors.push(data?.message || `${res.status} from ${url}`);
        } catch (err) {
          errors.push(err?.message || `Could not load ${url}`);
        }
      }
      setVariantsLoading(false);
      setCartError('Could not load gift wrap options.');
    }

    loadVariants();
  }, [giftWrapValue, variants.length]);

  // Keep selectedVariantId synchronized when type or color changes
  useEffect(() => {
    if (!variants.length) return;
    const match = findMatchingVariant(variants, selectedType, selectedColor, productOptions);
    if (match) {
      setSelectedVariantId(match.id);
    }
  }, [selectedType, selectedColor, variants, productOptions]);

  useEffect(() => {
    if (giftMessagePendingRef.current) return;

    giftMessageDraftRef.current = giftMessageValue;
    setGiftMessageDraft(giftMessageValue);
  }, [giftMessageValue]);

  useEffect(() => {
    return () => {
      if (giftMessageSaveTimerRef.current) {
        clearTimeout(giftMessageSaveTimerRef.current);
      }
    };
  }, []);

  const updateAttribute = async (key, value) => {
    if (!api?.applyAttributeChange || !canUpdateAttributes) {
      setError('Gift options cannot be saved for this checkout.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const trimmedValue = trimText(value);
      const result = await api.applyAttributeChange(
        trimmedValue
          ? {type: 'updateAttribute', key, value: trimmedValue}
          : {type: 'removeAttribute', key},
      );

      if (result?.type === 'error') {
        setError(result.message || 'Could not save gift options.');
      }
    } catch (saveError) {
      setError(saveError?.message || 'Could not save gift options.');
    } finally {
      setSaving(false);
    }
  };

  const saveGiftMessage = async (value) => {
    await updateAttribute(GIFT_MESSAGE_KEY, value);

    if (
      !giftMessageSaveTimerRef.current &&
      giftMessageDraftRef.current === value
    ) {
      giftMessagePendingRef.current = false;
    }
  };

  const scheduleGiftMessageUpdate = (value) => {
    giftMessageDraftRef.current = value;
    giftMessagePendingRef.current = true;
    setGiftMessageDraft(value);

    if (giftMessageSaveTimerRef.current) {
      clearTimeout(giftMessageSaveTimerRef.current);
    }

    giftMessageSaveTimerRef.current = setTimeout(() => {
      giftMessageSaveTimerRef.current = null;
      saveGiftMessage(value);
    }, GIFT_MESSAGE_SAVE_DELAY_MS);
  };

  const flushGiftMessageUpdate = () => {
    if (!giftMessageSaveTimerRef.current) return;

    clearTimeout(giftMessageSaveTimerRef.current);
    giftMessageSaveTimerRef.current = null;
    saveGiftMessage(giftMessageDraftRef.current);
  };

  // Add (or swap) the selected gift wrap variant in the cart
  const handleAddGiftWrapToCart = async () => {
    if (!selectedVariantId) return;
    if (!api?.applyCartLinesChange) {
      setCartError('Cannot modify cart at this stage.');
      return;
    }

    setAddingToCart(true);
    setCartError('');

    try {
      // Build the set of all gift wrap variant IDs we know about
      const giftWrapVariantIds = new Set(variants.map((v) => v.id));

      // Find ALL existing gift wrap lines in the live cart
      const existingLines = cartLines.filter(
        (line) => giftWrapVariantIds.has(line?.merchandise?.id)
      );

      // Remove every existing gift wrap line before adding the new one
      for (const existingLine of existingLines) {
        if (existingLine?.id) {
          const removeResult = await api.applyCartLinesChange({
            type: 'removeCartLine',
            id: existingLine.id,
            quantity: existingLine.quantity || 1,
          });
          if (removeResult?.type === 'error') {
            // Non-fatal — still continue removing others and add the new one
            console.warn('Could not remove gift wrap line:', removeResult.message);
          }
        }
      }

      // Check if gift wrap was already in the cart before this action
      const isFirstTimeAdd = existingLines.length === 0;

      // Add the newly selected gift wrap variant
      const picked = variants.find((v) => v.id === selectedVariantId);
      const styleName = picked?.title || (selectedType && selectedColor ? `${selectedType} / ${selectedColor}` : 'Gift wrap');

      const result = await api.applyCartLinesChange({
        type: 'addCartLine',
        merchandiseId: selectedVariantId,
        quantity: 1,
        attributes: [
          { key: 'Gift wrap style', value: styleName },
          { key: '_upsell_source', value: 'gift_wrap' },
        ],
      });

      if (result?.type === 'error') {
        setCartError(result.message || 'Could not add gift wrap to cart.');
      } else {
        setAddedVariantTitle(styleName);
        updateAttribute('Gift wrap style', styleName);
        // Only track initial add to order (do not double count when swapping/updating style)
        if (isFirstTimeAdd) {
          trackClick('gift_wrap_click', {
            ctaText: 'Add Gift Wrap',
            itemId: selectedVariantId,
            itemTitle: picked?.title ? `Gift Wrap: ${picked.title}` : 'Gift Wrap Option',
          });
        }
      }
    } catch (err) {
      setCartError(err?.message || 'Could not add gift wrap to cart.');
    } finally {
      setAddingToCart(false);
    }
  };

  // Remove gift wrap from cart
  const handleRemoveGiftWrap = async () => {
    if (!api?.applyCartLinesChange) return;
    setRemovingFromCart(true);
    setCartError('');

    try {
      const existingLines = cartLines.filter((line) =>
        giftWrapVariantIds.has(line?.merchandise?.id),
      );

      for (const existingLine of existingLines) {
        if (existingLine?.id) {
          await api.applyCartLinesChange({
            type: 'removeCartLine',
            id: existingLine.id,
            quantity: existingLine.quantity || 1,
          });
        }
      }
      setAddedVariantTitle('');
    } catch (err) {
      setCartError(err?.message || 'Could not remove gift wrap from cart.');
    } finally {
      setRemovingFromCart(false);
    }
  };

  if (loading) {
    return (
      <s-box padding="base" border="base" borderRadius="base">
        <s-skeleton-paragraph />
      </s-box>
    );
  }

  if (!config || (config.giftWrapEnabled === false && config.giftMessageEnabled === false)) {
    return null;
  }

  const canUpdateAttributes =
    api?.instructions?.current?.attributes?.canUpdateAttributes !== false;

  const activeVariant =
    variants.find((v) => v.id === selectedVariantId) || variants[0];
  const activePreviewImage =
    activeVariant?.image ||
    getStyleImage(selectedType, variants, productImage);

  return (
    <s-stack gap="base">
      <s-text type="strong">
        {limitText(trimText(config.giftOptionsHeading) || 'Gift options', 80)}
      </s-text>

      {config.giftWrapEnabled !== false && (
        <s-checkbox
          checked={giftWrapValue}
          disabled={saving || !canUpdateAttributes}
          label={limitText(trimText(config.giftWrapLabel) || 'Add gift wrap', 80)}
          onChange={(event) => {
            const checked = checkedFromEvent(event);
            updateAttribute(
              GIFT_WRAP_KEY,
              checked ? 'Yes' : '',
            );
            // If no variants exist, checking the box is the only action so track it
            if (checked && variants.length === 0) {
              trackClick('gift_wrap_click', {
                ctaText: 'Add gift wrap',
                itemTitle: 'Gift Wrap Option',
              });
            }
            if (!checked) {
              handleRemoveGiftWrap();
            }
          }}
        />
      )}

      {/* Gift wrap variant picker — shown when checkbox is checked */}
      {giftWrapValue && config.giftWrapEnabled !== false && (
        <s-box padding="small" border="base" borderRadius="base">
          {variantsLoading ? (
            <s-text>Loading gift wrap options…</s-text>
          ) : variants.length === 0 ? (
            <s-text tone="critical">No gift wrap styles available.</s-text>
          ) : productOptions.length >= 2 ? (
            <s-stack gap="base">
              {/* Option 1: Wrapping Style (Paper, Ribbon, Bag, Box) */}
              <s-stack gap="small-200">
                <s-text type="strong">Choose Style:</s-text>
                <s-grid gridTemplateColumns="1fr 1fr" gap="small">
                  {(productOptions[0]?.values || []).map((type) => {
                    const isSelected = selectedType === type;
                    return (
                      <s-button
                        key={type}
                        variant={isSelected ? 'primary' : 'secondary'}
                        onClick={() => {
                          setSelectedType(type);
                          setAddedToCart(false);
                        }}
                      >
                        {typeIcon(type)} {type}
                      </s-button>
                    );
                  })}
                </s-grid>
              </s-stack>

              {/* Option 2: Color Swatches (Sapphire Blue, Ignite Red, etc.) */}
              <s-stack gap="small-200">
                <s-text type="strong">Choose Color:</s-text>
                <s-grid gridTemplateColumns="1fr 1fr" gap="small">
                  {(productOptions[1]?.values || []).map((color) => {
                    const isSelected = selectedColor === color;
                    const swatch = getColorSwatch(color);
                    return (
                      <s-button
                        key={color}
                        variant={isSelected ? 'primary' : 'secondary'}
                        onClick={() => {
                          setSelectedColor(color);
                          setAddedToCart(false);
                        }}
                      >
                        {swatch.emoji} {color}
                      </s-button>
                    );
                  })}
                </s-grid>
              </s-stack>

              {/* Live Preview Box with Image & Price */}
              {/* Live Preview Box with Image & Price */}
              <s-box padding="small" background="subdued" borderRadius="base">
                <s-grid
                  gridTemplateColumns={activePreviewImage ? '72px 1fr' : '1fr'}
                  gap="small"
                  alignItems="center"
                >
                  {activePreviewImage ? (
                    <s-image
                      src={activePreviewImage}
                      alt={activeVariant?.title || selectedType}
                      aspectRatio="1/1"
                      objectFit="cover"
                      borderRadius="base"
                    />
                  ) : null}
                  <s-stack gap="small-200">
                    <s-text type="strong">
                      {typeIcon(selectedType)} {selectedType} —{' '}
                      {getColorSwatch(selectedColor).emoji} {selectedColor}
                    </s-text>
                    {activeVariant?.price && (
                      <s-text>${activeVariant.price}</s-text>
                    )}
                  </s-stack>
                </s-grid>
              </s-box>

              {cartError && <s-text tone="critical">{cartError}</s-text>}

              {/* Action Buttons: Add, Update, or Remove */}
              {isInCart && !isDifferentFromCart ? (
                <s-stack gap="small">
                  <s-text tone="success">
                    🎁 {inCartVariant?.title || addedVariantTitle} added to your order!
                  </s-text>
                  <s-button
                    variant="secondary"
                    disabled={removingFromCart}
                    onClick={handleRemoveGiftWrap}
                  >
                    {removingFromCart ? 'Removing…' : 'Remove Gift Wrap'}
                  </s-button>
                </s-stack>
              ) : isInCart && isDifferentFromCart ? (
                <s-stack gap="small">
                  <s-text tone="subdued">
                    In order: {inCartVariant?.title}
                  </s-text>
                  <s-grid gridTemplateColumns="1fr auto" gap="small">
                    <s-button
                      variant="primary"
                      disabled={addingToCart || !selectedVariantId}
                      onClick={handleAddGiftWrapToCart}
                    >
                      {addingToCart
                        ? 'Updating…'
                        : `Update to ${selectedType} (${activeVariant?.price ? `$${activeVariant.price}` : ''})`}
                    </s-button>
                    <s-button
                      variant="secondary"
                      disabled={removingFromCart}
                      onClick={handleRemoveGiftWrap}
                    >
                      {removingFromCart ? 'Removing…' : 'Remove'}
                    </s-button>
                  </s-grid>
                </s-stack>
              ) : (
                <s-button
                  disabled={addingToCart || !selectedVariantId}
                  onClick={handleAddGiftWrapToCart}
                >
                  {addingToCart
                    ? 'Adding…'
                    : `Add Gift Wrap (${selectedType || 'Option'})`}
                </s-button>
              )}
            </s-stack>
          ) : (
            <s-stack gap="small">
              <s-text>Select a gift wrap style:</s-text>

              <s-select
                label="Gift wrap style"
                value={selectedVariantId}
                onChange={(e) =>
                  setSelectedVariantId(e?.target?.value || selectedVariantId)
                }
              >
                {variants.map((v) => (
                  <s-option key={v.id} value={v.id}>
                    {v.title}
                    {v.price && v.price !== '0.00' ? ` — $${v.price}` : ''}
                  </s-option>
                ))}
              </s-select>

              {cartError && <s-text tone="critical">{cartError}</s-text>}

              {isInCart && !isDifferentFromCart ? (
                <s-stack gap="small">
                  <s-text tone="success">
                    🎁 {inCartVariant?.title || addedVariantTitle} added to your order!
                  </s-text>
                  <s-button
                    variant="secondary"
                    disabled={removingFromCart}
                    onClick={handleRemoveGiftWrap}
                  >
                    {removingFromCart ? 'Removing…' : 'Remove Gift Wrap'}
                  </s-button>
                </s-stack>
              ) : isInCart && isDifferentFromCart ? (
                <s-grid gridTemplateColumns="1fr auto" gap="small">
                  <s-button
                    variant="primary"
                    disabled={addingToCart || !selectedVariantId}
                    onClick={handleAddGiftWrapToCart}
                  >
                    {addingToCart ? 'Updating…' : 'Update Gift Wrap'}
                  </s-button>
                  <s-button
                    variant="secondary"
                    disabled={removingFromCart}
                    onClick={handleRemoveGiftWrap}
                  >
                    {removingFromCart ? 'Removing…' : 'Remove'}
                  </s-button>
                </s-grid>
              ) : (
                <s-button
                  disabled={addingToCart || !selectedVariantId}
                  onClick={handleAddGiftWrapToCart}
                >
                  {addingToCart ? 'Adding…' : 'Add Gift Wrap'}
                </s-button>
              )}
            </s-stack>
          )}
        </s-box>
      )}

      {config.giftMessageEnabled !== false && (
        <s-text-area
          label={limitText(
            trimText(config.giftMessageLabel) || 'Gift message',
            80,
          )}
          value={giftMessageDraft}
          placeholder={
            trimText(config.giftMessagePlaceholder) ||
            'Write a message for the recipient'
          }
          maxLength={500}
          rows={4}
          disabled={!canUpdateAttributes}
          onInput={(event) =>
            scheduleGiftMessageUpdate(valueFromEvent(event))
          }
          onBlur={flushGiftMessageUpdate}
        />
      )}

      {error && <s-text tone="critical">{error}</s-text>}
    </s-stack>
  );
}

function useSignalValue(signal) {
  const [value, setValue] = useState(signalValue(signal));

  useEffect(() => {
    if (!signal?.subscribe) return undefined;

    const unsubscribe = signal.subscribe((nextValue) => {
      setValue(nextValue);
    });

    setValue(signalValue(signal));

    return () => {
      unsubscribe();
    };
  }, [signal]);

  return value;
}

function signalValue(signal) {
  return signal?.value || signal?.current;
}

function attributeValue(attributes, key) {
  const attribute = attributes.find((item) => item?.key === key);

  return trimText(attribute?.value);
}

function checkedFromEvent(event) {
  return Boolean(/** @type {{checked?: boolean} | null} */ (event?.target)?.checked);
}

function valueFromEvent(event) {
  return String(/** @type {{value?: string} | null} */ (event?.target)?.value || '');
}

function extensionApi() {
  return typeof globalThis !== 'undefined' ? globalThis.shopify : shopify;
}

function shopDomain() {
  try {
    const api = extensionApi();
    const shop = api?.shop;
    const candidates = [
      shop?.myshopifyDomain,
      shop?.myshopifyDomain?.current,
      shop?.domain,
      shop?.domain?.current,
    ];
    for (const c of candidates) {
      const v = typeof c === 'string' ? c : c?.value || c?.current;
      if (v && typeof v === 'string') {
        return v.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
      }
    }
  } catch (e) {
    // ignore
  }
  return '';
}

function typeIcon(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('paper')) return '📜';
  if (t.includes('ribbon')) return '🎀';
  if (t.includes('bag')) return '🛍️';
  if (t.includes('box')) return '🎁';
  return '📦';
}

function getColorSwatch(color) {
  const c = (color || '').toLowerCase();
  if (c.includes('sapphire') || c.includes('blue') || c.includes('navy')) {
    return { emoji: '🔵', hex: '#1E40AF' };
  }
  if (c.includes('ignite') || c.includes('red') || c.includes('crimson') || c.includes('ruby')) {
    return { emoji: '🔴', hex: '#DC2626' };
  }
  if (c.includes('honey') || c.includes('gold') || c.includes('yellow')) {
    return { emoji: '🟡', hex: '#EAB308' };
  }
  if (c.includes('cosmic') || c.includes('black') || c.includes('dark')) {
    return { emoji: '⚫', hex: '#111827' };
  }
  if (c.includes('silver') || c.includes('grey') || c.includes('gray')) {
    return { emoji: '⚪', hex: '#9CA3AF' };
  }
  if (c.includes('green') || c.includes('emerald')) {
    return { emoji: '🟢', hex: '#16A34A' };
  }
  if (c.includes('pink') || c.includes('rose')) {
    return { emoji: '🌸', hex: '#EC4899' };
  }
  if (c.includes('purple') || c.includes('violet')) {
    return { emoji: '🟣', hex: '#9333EA' };
  }
  if (c.includes('white')) {
    return { emoji: '⚪', hex: '#FFFFFF' };
  }
  return { emoji: '🎨', hex: '#6B7280' };
}

function findMatchingVariant(variants, selectedType, selectedColor, options) {
  if (!Array.isArray(variants) || !variants.length) return null;

  if (Array.isArray(options) && options.length >= 2) {
    const typeOptName = options[0].name;
    const colorOptName = options[1].name;
    const match = variants.find((v) => {
      const typeMatch = v.selectedOptions?.some(
        (so) => so.name === typeOptName && so.value === selectedType,
      );
      const colorMatch = v.selectedOptions?.some(
        (so) => so.name === colorOptName && so.value === selectedColor,
      );
      return typeMatch && colorMatch;
    });
    if (match) return match;
  }

  if (selectedType && selectedColor) {
    const match = variants.find((v) => {
      const title = (v.title || '').toLowerCase();
      return (
        title.includes(selectedType.toLowerCase()) &&
        title.includes(selectedColor.toLowerCase())
      );
    });
    if (match) return match;
  }

  if (selectedType) {
    const match = variants.find((v) =>
      (v.title || '').toLowerCase().includes(selectedType.toLowerCase()),
    );
    if (match) return match;
  }

  return variants[0];
}

function getStyleImage(type, variants, productImage) {
  if (!Array.isArray(variants)) return productImage || null;
  const match = variants.find(
    (v) =>
      (v.title || '').toLowerCase().includes((type || '').toLowerCase()) &&
      v.image,
  );
  return match?.image || productImage || null;
}
