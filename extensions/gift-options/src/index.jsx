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
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [addingToCart, setAddingToCart] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [cartError, setCartError] = useState('');

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

  // Add the selected gift wrap variant to the cart
  const handleAddGiftWrapToCart = async () => {
    if (!selectedVariantId) return;
    if (!api?.applyCartLinesChange) {
      setCartError('Cannot modify cart at this stage.');
      return;
    }

    setAddingToCart(true);
    setCartError('');

    try {
      const result = await api.applyCartLinesChange({
        type: 'addCartLine',
        merchandiseId: selectedVariantId,
        quantity: 1,
      });

      if (result?.type === 'error') {
        setCartError(result.message || 'Could not add gift wrap to cart.');
      } else {
        setAddedToCart(true);
      }
    } catch (err) {
      setCartError(err?.message || 'Could not add gift wrap to cart.');
    } finally {
      setAddingToCart(false);
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
            updateAttribute(
              GIFT_WRAP_KEY,
              checkedFromEvent(event) ? 'Yes' : '',
            );
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
          ) : (
            <s-stack gap="small">
              <s-text>Choose a gift wrap style:</s-text>

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

              {addedToCart ? (
                <s-text tone="success">🎁 Gift wrap added to your order!</s-text>
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
