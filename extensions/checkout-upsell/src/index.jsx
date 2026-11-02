/* global globalThis */
/* eslint react/prop-types: off */
import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useMemo, useState} from 'preact/hooks';
import {fetchActiveBlock} from '../../shared/blocks';
import {claimExtensionRender} from '../../shared/render-once';
import {limitText, trimText} from '../../shared/text';
import {trackClick} from '../../shared/analytics';

export default () => {
  try {
    if (!claimExtensionRender('checkout-upsell')) return;

    render(<Extension />, document.body);
  } catch (error) {
    console.error('Checkout upsell failed to render:', error);
  }
};

function Extension() {
  const [config, setConfig] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [eligible, setEligible] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadBlock() {
      try {
        const block = await fetchActiveBlock('checkoutUpsell');
        const nextConfig = block?.config || null;

        if (!mounted) return;

        setConfig(nextConfig);

        if (!nextConfig) {
          setEligible(false);
          return;
        }

        const sourceProducts = await conditionProducts(nextConfig);
        const nextEligible = matchesProductConditions(
          sourceProducts,
          nextConfig.productConditions,
        );

        if (!nextEligible) {
          if (mounted) {
            setEligible(false);
            setProducts([]);
          }
          return;
        }

        const nextProducts = await offerProducts(nextConfig);

        if (mounted) {
          setEligible(true);
          setProducts(nextProducts);
        }
      } catch (error) {
        console.error(error);

        if (mounted) {
          setConfig(null);
          setEligible(false);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadBlock();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <s-box padding="base" border="base" borderRadius="base">
        <s-skeleton-paragraph />
      </s-box>
    );
  }

  if (!eligible || !config || !products.length) return null;

  const heading = limitText(
    trimText(config.checkoutUpsellHeading) || 'You might also like these',
    80,
  );

  return (
    <s-stack gap="base">
      <s-text type="strong">{heading}</s-text>

      <s-stack gap="base">
        {products.map((product) => (
          <CheckoutUpsellProduct key={product.id} product={product} />
        ))}
      </s-stack>
    </s-stack>
  );
}

function CheckoutUpsellProduct({product}) {
  const firstVariant = product.variants[0];
  const [variantId, setVariantId] = useState(firstVariant.id);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState(
    /** @type {'info' | 'success' | 'critical'} */ ('info'),
  );
  const selectedVariant = useMemo(
    () =>
      product.variants.find((variant) => variant.id === variantId) ||
      firstVariant,
    [firstVariant, product.variants, variantId],
  );

  const addProduct = async () => {
    const extensionApi =
      typeof globalThis !== 'undefined' ? globalThis.shopify : shopify;
    const canAdd =
      extensionApi.instructions?.current?.lines?.canAddCartLine !== false;

    if (!canAdd) {
      setTone('critical');
      setMessage('This checkout cannot add products right now.');
      return;
    }

    setAdding(true);
    setMessage('');

    try {
      const result = await extensionApi.applyCartLinesChange({
        type: 'addCartLine',
        merchandiseId: selectedVariant.id,
        quantity,
        attributes: [
          { key: '_upsell_source', value: 'checkout_upsell' },
        ],
      });

      if (result?.type === 'error') {
        setTone('critical');
        setMessage(result.message || 'Could not add this product.');
        return;
      }

      setTone('success');
      trackClick('checkout_upsell_click', {
        ctaText: 'Add',
        itemId: product.id,
        itemTitle: product.title,
        variantId: selectedVariant.id,
      });
      // setMessage('Added to cart.');
    } catch (error) {
      setTone('critical');
      setMessage(error?.message || 'Could not add this product.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <s-box padding="base" border="base" borderRadius="base">
      <s-grid
        gap="base"
        gridTemplateColumns="64px minmax(0, 1fr) auto"
        alignItems="center"
      >
        {product.image ? (
          <s-image
            src={product.image}
            alt={product.title}
            aspectRatio="1/1"
            objectFit="cover"
            borderRadius="base"
          />
        ) : (
          <s-box minBlockSize="64px" background="subdued" borderRadius="base" />
        )}

        <s-stack gap="small-200">
          <s-text>{limitText(product.title, 60)}</s-text>
          {selectedVariant.price && (
            <s-text type="strong">{selectedVariant.price}</s-text>
          )}

          {product.variants.length > 1 && (
            <s-select
              label="Variant"
              value={variantId}
              onChange={(event) => setVariantId(selectedValue(event, variantId))}
            >
              {product.variants.map((variant) => (
                <s-option key={variant.id} value={variant.id}>
                  {variant.title}
                  {variant.price ? ` - ${variant.price}` : ''}
                </s-option>
              ))}
            </s-select>
          )}

          {/* <s-grid
            gap="small-200"
            gridTemplateColumns="auto 48px auto"
            alignItems="end"
          >
            <s-button
              disabled={adding || quantity <= 1}
              onClick={() => setQuantity((current) => Math.max(1, current - 1))}
            >
              -
            </s-button>
            <s-text-field
              // label="Quantity"
              type="number"
              value={String(quantity)}
              onInput={(event) => setQuantity(normalizeQuantity(event.target.value))}
            />
            <s-button
              disabled={adding}
              onClick={() => setQuantity((current) => Math.min(99, current + 1))}
            >
              +
            </s-button>
          </s-grid> */}
          <s-grid
  gridTemplateColumns="32px 42px 32px"
  gap="small-200"
  alignItems="center"
>
  <s-button
    disabled={adding || quantity <= 1}
    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
  >
    −
  </s-button>

  <s-text-field
    type="number"
    value={String(quantity)}
    onInput={(event) =>
      setQuantity(normalizeQuantity(event.target.value))
    }
  />

  <s-button
    disabled={adding}
    onClick={() => setQuantity((q) => Math.min(99, q + 1))}
  >
    +
  </s-button>
</s-grid>

          {message && <s-text tone={tone}>{message}</s-text>}
        </s-stack>

        <s-button disabled={adding} onClick={addProduct}>
          {adding ? 'Adding...' : 'Add'}
        </s-button>
      </s-grid>
    </s-box>
  );
}

async function offerProducts(config) {
  const source =
    config?.checkoutUpsellSource ||
    config?.CheckoutUpsellSource ||
    'specific_products';
  const maxProducts = maxProductsToShow(config);
  const cartProductIds = currentCartProductIds();

  if (source === 'related_products') {
    return limitProducts(
      await shopifyRecommendationProducts(cartProductIds, maxProducts),
      maxProducts,
    );
  }

  if (source === 'collection') {
    return limitProducts(
      await collectionRecommendationProducts(cartProductIds, maxProducts),
      maxProducts,
    );
  }

  const selectedProducts = Array.isArray(config?.checkoutUpsellProducts)
    ? config.checkoutUpsellProducts
    : [];

  return limitProducts(
    selectedProducts.filter(
      (product) => product?.variants?.length && !cartProductIds.has(product.id),
    ),
    selectedProducts.length,
  );
}

async function shopifyRecommendationProducts(cartProductIds, maxProducts) {
  const extensionApi =
    typeof globalThis !== 'undefined' ? globalThis.shopify : shopify;

  if (!extensionApi?.query || !cartProductIds.size) return [];

  const recommendedProducts = new Map();

  for (const productId of cartProductIds) {
    const result = await extensionApi.query(
      `query CheckoutProductRecommendations($productId: ID!) {
        productRecommendations(productId: $productId) {
          ...CheckoutUpsellProductFields
        }
      }

      fragment CheckoutUpsellProductFields on Product {
        id
        title
        handle
        featuredImage {
          url
        }
        variants(first: 10) {
          nodes {
            id
            title
            availableForSale
            price {
              amount
              currencyCode
            }
          }
        }
      }`,
      {
        variables: {
          productId,
        },
      },
    );

    addRecommendedProducts(
      recommendedProducts,
      result?.data?.productRecommendations || [],
      cartProductIds,
    );

    if (recommendedProducts.size >= maxProducts) break;
  }

  return Array.from(recommendedProducts.values());
}

async function collectionRecommendationProducts(cartProductIds, maxProducts) {
  const extensionApi =
    typeof globalThis !== 'undefined' ? globalThis.shopify : shopify;
  const productIds = Array.from(cartProductIds);

  if (!extensionApi?.query || !productIds.length) return [];

  const result = await extensionApi.query(
    `query CheckoutCollectionRecommendations($ids: [ID!]!, $limit: Int!) {
      nodes(ids: $ids) {
        ... on Product {
          collections(first: 10) {
            nodes {
              products(first: $limit) {
                nodes {
                  ...CheckoutUpsellProductFields
                }
              }
            }
          }
        }
      }
    }

    fragment CheckoutUpsellProductFields on Product {
      id
      title
      handle
      featuredImage {
        url
      }
      variants(first: 10) {
        nodes {
          id
          title
          availableForSale
          price {
            amount
            currencyCode
          }
        }
      }
    }`,
    {
      variables: {
        ids: productIds,
        limit: Math.max(maxProducts, 4),
      },
    },
  );

  const recommendedProducts = new Map();
  const products = (result?.data?.nodes || [])
    .flatMap((product) => product?.collections?.nodes || [])
    .flatMap((collection) => collection?.products?.nodes || []);

  addRecommendedProducts(recommendedProducts, products, cartProductIds);

  return Array.from(recommendedProducts.values());
}

function addRecommendedProducts(recommendedProducts, products, cartProductIds) {
  products
    .map(normalizeStorefrontProduct)
    .filter(Boolean)
    .forEach((product) => {
      if (cartProductIds.has(product.id) || recommendedProducts.has(product.id)) {
        return;
      }

      recommendedProducts.set(product.id, product);
    });
}

function normalizeStorefrontProduct(product) {
  if (!product?.id || !product?.title) return null;

  const variants = (product?.variants?.nodes || [])
    .filter((variant) => variant?.id && variant.availableForSale !== false)
    .map((variant) => ({
      id: variant.id,
      title: variant.title || 'Default',
      price: formatMoney(variant.price),
    }));

  if (!variants.length) return null;

  return {
    id: product.id,
    title: product.title,
    handle: product.handle || '',
    image: product.featuredImage?.url || '',
    variants,
  };
}

function limitProducts(products, maxProducts) {
  const limit = Math.max(1, Math.min(20, Number(maxProducts) || 4));

  return products.slice(0, limit);
}

function maxProductsToShow(config) {
  const value = Number(config?.checkoutUpsellMaxProducts);

  if (!Number.isFinite(value)) return 4;

  return Math.max(1, Math.min(20, Math.floor(value)));
}

function currentCartProductIds() {
  const extensionApi =
    typeof globalThis !== 'undefined' ? globalThis.shopify : shopify;
  const lines = currentValue(extensionApi?.lines) || [];

  return new Set(
    lines
      .map((line) => line?.merchandise?.product?.id)
      .filter(Boolean),
  );
}

async function conditionProducts(config) {
  const conditions = Array.isArray(config?.productConditions)
    ? config.productConditions
    : [];

  if (!conditions.length) return [];

  const extensionApi =
    typeof globalThis !== 'undefined' ? globalThis.shopify : shopify;
  const lines = currentValue(extensionApi?.lines) || [];
  const lineProducts = lines
    .map((line) => line?.merchandise?.product)
    .filter((product) => product?.id);

  if (!lineProducts.length) return [];

  if (!conditionsNeedStorefrontData(conditions)) {
    return lineProducts;
  }

  const productIds = lineProducts
    .map((product) => product.id)
    .filter(Boolean)
    .filter((id, index, all) => all.indexOf(id) === index);

  if (!productIds.length || !extensionApi?.query) {
    return lineProducts;
  }

  try {
    const result = /** @type {{data?: {nodes?: Array<unknown>}}} */ (
      await extensionApi.query(
      `query ProductConditions($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Product {
            id
            title
            handle
            tags
            collections(first: 50) {
              nodes {
                id
                title
                handle
              }
            }
          }
        }
      }`,
      {
        variables: {
          ids: productIds,
        },
      },
      )
    );

    const nodes = result?.data?.nodes || [];

    return nodes.filter((product) => product?.id);
  } catch (error) {
    console.error('Could not load product condition data:', error);
    return lineProducts;
  }
}

function conditionsNeedStorefrontData(conditions) {
  return conditions.some(
    (condition) =>
      condition?.type === 'tags' || condition?.type === 'collections',
  );
}

function matchesProductConditions(products, conditions) {
  const normalizedConditions = normalizeProductConditions(conditions);

  if (!normalizedConditions.length) return true;

  return normalizedConditions.every((condition) => {
    const matched = products.some((product) =>
      productMatchesCondition(product, condition),
    );

    return condition.rule === 'exclude' ? !matched : matched;
  });
}

function productMatchesCondition(product, condition) {
  const wanted = condition.values
    .flatMap((value) => [value.id, value.handle, value.label])
    .map(normalizeToken)
    .filter(Boolean);

  if (!wanted.length) return false;

  const actual =
    condition.type === 'collections'
      ? productCollections(product)
      : productTags(product);

  return actual.some((token) => wanted.includes(token));
}

function productTags(product) {
  return Array.isArray(product?.tags)
    ? product.tags.map(normalizeToken).filter(Boolean)
    : [];
}

function productCollections(product) {
  const collections = Array.isArray(product?.collections)
    ? product.collections
    : product?.collections?.nodes || [];

  return collections
    .flatMap((collection) => [
      collection?.id,
      collection?.handle,
      collection?.title,
      collection?.label,
    ])
    .map(normalizeToken)
    .filter(Boolean);
}

function normalizeProductConditions(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((condition) => {
      const type =
        condition?.type === 'collections' ? 'collections' : 'tags';
      const rule =
        condition?.rule === 'exclude' ? 'exclude' : 'include';
      const values = Array.isArray(condition?.values)
        ? condition.values.map(normalizeConditionValue).filter(Boolean)
        : [];

      if (!values.length) return null;

      return {type, rule, values};
    })
    .filter(Boolean);
}

function normalizeConditionValue(value) {
  if (typeof value === 'string') {
    const label = value.trim();

    return label ? {label} : null;
  }

  if (!value || typeof value !== 'object') return null;

  const label =
    stringValue(value.label) ||
    stringValue(value.title) ||
    stringValue(value.handle) ||
    stringValue(value.id);

  if (!label) return null;

  return {
    id: stringValue(value.id),
    handle: stringValue(value.handle),
    label,
  };
}

function currentValue(value) {
  return value?.current || value;
}

function normalizeQuantity(value) {
  const quantity = Number(value);

  if (!Number.isFinite(quantity)) return 1;

  return Math.max(1, Math.min(99, Math.floor(quantity)));
}

function formatMoney(value) {
  const amount = Number(value?.amount);
  const currencyCode = value?.currencyCode;

  if (!Number.isFinite(amount) || !currencyCode) return '';

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
    }).format(amount);
  } catch (error) {
    return `${amount.toFixed(2)} ${currencyCode}`;
  }
}

function normalizeToken(value) {
  return typeof value === 'string'
    ? value.trim().toLowerCase()
    : '';
}

function stringValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function selectedValue(event, fallback) {
  return event?.target?.value || fallback;
}
