import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {
  useCallback,
  useEffect,
  useState,
} from 'preact/hooks';
import {apiUrls} from '../../shared/app-config';
import {trackThankYouClick} from '../../shared/analytics';
import {limitText} from '../../shared/text';
import {fetchActiveBlock} from '../../shared/blocks';
import {claimExtensionRender} from '../../shared/render-once';
import {fetchWithTimeout} from '../../shared/fetch-with-timeout';

export default () => {
  try {
    if (!claimExtensionRender('upsell')) return;

    render(<Extension />, document.body);
  } catch (error) {
    console.error('Extension failed to render:', error);
  }
};

function Extension() {
  const orderConfirmation = shopify.orderConfirmation.current;

  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [blockConfig, setBlockConfig] = useState(null);
  const [blockEnabled, setBlockEnabled] = useState(false);
  const [hiddenByConditions, setHiddenByConditions] = useState(false);

  // 10-minute timer for 1-Click Zero-Shipping Upsell
  const [timeLeft, setTimeLeft] = useState(600);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  const loadRecommendations = useCallback(async () => {
    try {
      const orderId = signalValue(orderConfirmation?.order?.id);
      const orderNumber = signalValue(orderConfirmation?.number);
      const checkoutToken = signalValue(shopify.checkoutToken);
      const shop = shopDomain(shopify.shop);
      const storefrontUrl = shopUrl(shopify.shop);

      if (!orderId && !orderNumber && !checkoutToken) {
        setError('Order details not found');
        return;
      }

      if (!shop) {
        setError('Shop domain not found');
        return;
      }

      const data = await fetchRecommendations({
        orderId,
        orderNumber,
        checkoutToken,
        shop,
        storefrontUrl,
        productConditions: blockConfig?.productConditions || [],
      });

      if (data.eligible === false) {
        setHiddenByConditions(true);
        setRecommendedProducts([]);
        return;
      }

      setRecommendedProducts(data.products || []);
    } catch (e) {
      console.error('Failed to load recommendations:', {
        error: e?.message,
        stack: e?.stack,
      });
      setError(e?.message || 'Could not load recommendations');
    } finally {
      setLoading(false);
    }
  }, [blockConfig, orderConfirmation]);

  useEffect(() => {
    fetchActiveBlock('upsell')
      .then((block) => {
        if (!block) {
          setLoading(false);
          return;
        }

        setBlockConfig(block.config || null);
        setBlockEnabled(true);
      })
      .catch((err) => {
        console.error(err);
        setBlockConfig(null);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!blockEnabled || !blockConfig) return;

    loadRecommendations();
  }, [blockConfig, blockEnabled, loadRecommendations]);

  const heading =
    blockConfig?.upsellHeading || '📦 Add to the Same Box — 0 Extra Shipping Fee!';
  const emptyMessage =
    blockConfig?.emptyMessage || 'No recommendations found';

  if ((!blockEnabled || hiddenByConditions) && !loading) return null;

  return (
    <s-stack gap="base">
      {loading ? (
        <s-box padding="base" border="base" borderRadius="base">
          <s-skeleton-paragraph />
        </s-box>
      ) : error ? (
        <s-box padding="base" border="base" borderRadius="base">
          <s-text tone="critical">{error}</s-text>
        </s-box>
      ) : !recommendedProducts.length ? (
        <s-box padding="base" border="base" borderRadius="base">
          <s-text>{emptyMessage}</s-text>
        </s-box>
      ) : (
        <>
          <s-box padding="base" border="base" borderRadius="base" background="subdued">
            <s-stack gap="small">
              <s-text type="strong">{heading}</s-text>
              {timeLeft > 0 ? (
                <s-text tone="success">
                  ⚡ Add before your box is packed in {formatTime(timeLeft)} — 0 extra shipping fee!
                </s-text>
              ) : (
                <s-text tone="critical">
                  ⏰ Timer expired! Orders are being packed now.
                </s-text>
              )}
            </s-stack>
          </s-box>

          <s-grid
            gap="base"
            gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))"
          >
            {recommendedProducts.map((product) => (
              <UpsellProductCard
                key={product.id}
                product={product}
                timerExpired={timeLeft <= 0}
                orderConfirmation={orderConfirmation}
              />
            ))}
          </s-grid>
        </>
      )}
    </s-stack>
  );
}

function UpsellProductCard({product, timerExpired, orderConfirmation}) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const defaultVariantId =
    product.variantId ||
    (variants[0] ? variants[0].id : '') ||
    product.id ||
    '';

  const [selectedVariantId, setSelectedVariantId] = useState(defaultVariantId);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusTone, setStatusTone] = useState('info');

  useEffect(() => {
    if (defaultVariantId && !selectedVariantId) {
      setSelectedVariantId(defaultVariantId);
    }
  }, [defaultVariantId, selectedVariantId]);

  const selectedVariant = variants.find((v) => v.id === selectedVariantId) || variants[0];
  const displayPrice = selectedVariant?.price || product.price || '';

  const handleAddToOrder = async () => {
    const variantToAdd =
      selectedVariantId ||
      defaultVariantId ||
      product.variantId ||
      (variants[0] ? variants[0].id : '') ||
      product.id;

    if (timerExpired) {
      setStatusTone('critical');
      setStatusMessage('Time limit expired for adding to this package.');
      return;
    }

    setAdding(true);
    setStatusMessage('');

    trackThankYouClick('add_to_same_box_click', {
      ctaText: 'Add to Same Box',
      itemId: product.id,
      itemTitle: product.title,
      variantId: variantToAdd,
    });

    try {
      const orderId = signalValue(orderConfirmation?.order?.id);
      const orderNumber = signalValue(orderConfirmation?.number);
      const checkoutToken = signalValue(shopify.checkoutToken);
      const shop = shopDomain(shopify.shop);

      const response = await addToOrderApi({
        shop,
        orderId,
        orderNumber,
        checkoutToken,
        variantId: variantToAdd,
        productId: product.id,
        quantity: 1,
      });

      console.log("response: ", response);

      if (response?.success) {
        setAdded(true);
        setStatusTone('success');
        setStatusMessage('✅ Added to your package! 0 extra shipping fee.');
      } else {
        setStatusTone('critical');
        setStatusMessage(response?.message || 'Could not add item to order.');
      }
    } catch (err) {
      console.error('Add to order failed:', err);
      setStatusTone('critical');
      setStatusMessage(err?.message || 'Could not add item to order.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <s-box padding="base" border="base" borderRadius="base">
      <s-stack gap="small">
        {product.image && (
          <s-link
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <s-image
              src={product.image}
              alt={product.title}
              aspectRatio="1/1"
              objectFit="cover"
              inlineSize="fill"
              borderRadius="base"
            />
          </s-link>
        )}

        <s-text type="strong">{limitText(product.title, 60)}</s-text>

        {displayPrice && <s-text>{displayPrice}</s-text>}

        {variants.length > 1 && (
          <s-select
            label="Option"
            value={selectedVariantId}
            onChange={(e) => setSelectedVariantId(e?.target?.value || selectedVariantId)}
          >
            {variants.map((v) => (
              <s-option key={v.id} value={v.id}>
                {v.title} {v.price ? `- ${v.price}` : ''}
              </s-option>
            ))}
          </s-select>
        )}

        {statusMessage && <s-text tone={statusTone}>{statusMessage}</s-text>}

        <s-button
          disabled={adding || added || timerExpired}
          onClick={handleAddToOrder}
        >
          {added ? 'Added to Box ✓' : adding ? 'Adding to box...' : 'Add to Box (0 Shipping)'}
        </s-button>
      </s-stack>
    </s-box>
  );
}

async function addToOrderApi(payload) {
  const errors = [];

  for (const url of apiUrls('/api/add-to-order')) {
    try {
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        errors.push(data?.message || `${response.status} from ${url}`);
        continue;
      }

      return data;
    } catch (error) {
      errors.push(error?.message || `Could not call ${url}`);
    }
  }

  throw new Error(errors.join(' | ') || 'Could not add item to order');
}

async function fetchRecommendations(payload) {
  const errors = [];

  for (const url of apiUrls('/api/recommendations')) {
    try {
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        errors.push(data?.message || `${response.status} from ${url}`);
        continue;
      }

      return data;
    } catch (error) {
      errors.push(error?.message || `Could not load ${url}`);
    }
  }

  throw new Error(errors.join(' | ') || 'Could not load recommendations');
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function shopDomain(shop) {
  return firstNormalized([
    shop?.myshopifyDomain,
    shop?.domain,
    shop?.storefrontUrl,
    shop?.storefrontUrl?.current,
  ]);
}

function signalValue(value) {
  return value?.current || value;
}

function shopUrl(shop) {
  const value = firstValue([
    shop?.storefrontUrl,
    shop?.storefrontUrl?.current,
    shop?.domain,
    shop?.myshopifyDomain,
  ]);

  if (!value) return '';

  return String(value).startsWith('http')
    ? String(value)
    : `https://${value}`;
}

function firstNormalized(values) {
  const value = firstValue(values);

  if (!value) return '';

  const text = String(value).trim();

  try {
    return new URL(text).hostname.toLowerCase();
  } catch (error) {
    return text
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .toLowerCase();
  }
}

function firstValue(values) {
  return values
    .map(signalValue)
    .find(
      (value) =>
        typeof value === 'string' ||
        value instanceof URL,
    );
}
