/* eslint-env node */
import {unauthenticated} from '../shopify.server';

const RECOMMENDATION_METAFIELD = {
  namespace: 'custom',
  key: 'recommended_products',
};

const PRODUCT_FIELDS_FRAGMENT = `
  id
  title
  handle
  onlineStoreUrl
  featuredImage {
    url
  }
  variants(first: 10) {
    nodes {
      id
      title
      price
    }
  }
`;

export async function action({request}) {
  try {
    if (request.method === 'OPTIONS') {
      return responseJson({});
    }
    const body = await request.json();
    const {orderId, orderNumber, checkoutToken} = body;
    const productConditions = normalizeProductConditions(
      body.productConditions,
    );
    const shop =
      body.shop || process.env.SHOPIFY_SHOP_DOMAIN;
    const storefrontUrl =
      body.storefrontUrl || `https://${shop}`;

    if (!shop) {
      return responseJson({
        success: false,
        message:
          'Shop domain is required to create an Admin API client',
      });
    }

    if (!orderId && !checkoutToken && !orderNumber) {
      return responseJson({
        success: false,
        message: 'Order ID, order number, or checkout token is required',
      });
    }

    const adminOrderId =
      orderId ? normalizeOrderId(orderId) : '';

    const {admin} =
      await unauthenticated.admin(shop);

    const orderData = adminOrderId
      ? await fetchOrderById(
          admin,
          adminOrderId,
        )
      : null;

    let order =
      orderData?.data?.order;

    if (!order && checkoutToken) {
      const orderSearchData = await fetchOrderByQuery(
        admin,
        `checkout_token:${checkoutToken}`,
      );
      order = orderSearchData?.data?.orders?.nodes?.[0];
    }

    if (!order && orderNumber) {
      const query = String(orderNumber).startsWith('#')
        ? `name:${orderNumber}`
        : `name:#${orderNumber}`;
      const orderSearchData = await fetchOrderByQuery(admin, query);
      order = orderSearchData?.data?.orders?.nodes?.[0];
    }

    if (!order && orderData?.errors?.length) {
      return responseJson({
        success: false,
        message: graphQLErrorMessage(orderData),
        orderId,
        adminOrderId,
      });
    }

    if (!order) {
      return responseJson({
        success: false,
        message: 'Order not found',
        orderId,
        adminOrderId,
      });
    }

    const purchasedProducts = (order?.lineItems?.nodes || [])
      .map((lineItem) => lineItem?.variant?.product)
      .filter((product) => product?.id);

    if (!purchasedProducts.length) {
      return responseJson({
        success: false,
        message: 'No product found',
      });
    }

    if (!matchesProductConditions(purchasedProducts, productConditions)) {
      return responseJson({
        success: true,
        eligible: false,
        order: {
          id: order.id,
          name: order.name,
        },
        sourceProducts: purchasedProducts.map(productSummary),
        products: [],
      });
    }

    const purchasedProductIds = new Set(
      purchasedProducts.map((product) => product.id),
    );
    const recommendedProducts = new Map();

    for (const purchasedProduct of purchasedProducts) {
      const metafield = purchasedProduct.metafield;
      const referencedProducts = [
        ...(metafield?.references?.nodes || []),
        ...(metafield?.reference ? [metafield.reference] : []),
      ].filter(Boolean);

      for (const product of referencedProducts) {
        if (!product?.id || purchasedProductIds.has(product.id)) {
          continue;
        }

        if (!recommendedProducts.has(product.id)) {
          const formatted = formatProduct(product, storefrontUrl);
          if (formatted) {
            recommendedProducts.set(product.id, formatted);
          }
        }
      }
    }

    // Fallback: If no metafield recommendations were set up, load active store products
    if (recommendedProducts.size === 0) {
      const fallbackProducts = await fetchFallbackProducts(admin);
      for (const product of fallbackProducts) {
        if (purchasedProductIds.has(product.id) || recommendedProducts.has(product.id)) {
          continue;
        }
        const formatted = formatProduct(product, storefrontUrl);
        if (formatted) {
          recommendedProducts.set(product.id, formatted);
        }
      }
    }

    const finalProductsList = Array.from(recommendedProducts.values()).slice(0, 8);

    // Ensure every single recommended product has populated variant IDs
    await ensureProductVariants(admin, finalProductsList);

    return responseJson({
      success: true,
      order: {
        id: order.id,
        name: order.name,
      },
      sourceProducts: purchasedProducts.map((product) => ({
        ...productSummary(product),
      })),
      products: finalProductsList,
    });
  } catch (error) {
    console.error('Error in recommendations action:', error);
    const message =
      error instanceof Error ? error.message : 'Unexpected recommendation error';

    return responseJson({
      success: false,
      message,
    });
  }
}

async function fetchOrderById(admin, adminOrderId) {
  const orderResponse = await admin.graphql(
    `
      query GetOrder($id: ID!) {
        order(id: $id) {
          id
          name

          lineItems(first: 50) {
            nodes {
              title

              variant {
                product {
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

                  metafield(
                    namespace: "${RECOMMENDATION_METAFIELD.namespace}"
                    key: "${RECOMMENDATION_METAFIELD.key}"
                  ) {
                    reference {
                      ... on Product {
                        ${PRODUCT_FIELDS_FRAGMENT}
                      }
                    }

                    references(first: 10) {
                      nodes {
                        ... on Product {
                          ${PRODUCT_FIELDS_FRAGMENT}
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
    {
      variables: {
        id: adminOrderId,
      },
    },
  );

  return orderResponse.json();
}

async function fetchOrderByQuery(admin, query) {
  const orderResponse = await admin.graphql(
    `
      query FindOrder($query: String!) {
        orders(first: 1, query: $query, sortKey: CREATED_AT, reverse: true) {
          nodes {
            id
            name

            lineItems(first: 50) {
              nodes {
                title

                variant {
                  product {
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

                    metafield(
                      namespace: "${RECOMMENDATION_METAFIELD.namespace}"
                      key: "${RECOMMENDATION_METAFIELD.key}"
                    ) {
                      reference {
                        ... on Product {
                          ${PRODUCT_FIELDS_FRAGMENT}
                        }
                      }

                      references(first: 10) {
                        nodes {
                          ... on Product {
                            ${PRODUCT_FIELDS_FRAGMENT}
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
    {
      variables: {
        query,
      },
    },
  );

  return orderResponse.json();
}

async function fetchFallbackProducts(admin) {
  try {
    const response = await admin.graphql(`
      query FallbackProducts {
        products(first: 6, query: "status:active") {
          nodes {
            ${PRODUCT_FIELDS_FRAGMENT}
          }
        }
      }
    `);
    const data = await response.json();
    return data?.data?.products?.nodes || [];
  } catch (err) {
    console.error('Failed to fetch fallback products:', err);
    return [];
  }
}

async function ensureProductVariants(admin, products) {
  const missingVariantProducts = products.filter(
    (p) => !p.variantId && (!p.variants || !p.variants.length),
  );

  if (!missingVariantProducts.length) return;

  const productIds = missingVariantProducts.map((p) => p.id);

  try {
    const response = await admin.graphql(
      `
        query GetVariantsForProducts($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product {
              id
              variants(first: 10) {
                nodes {
                  id
                  title
                  price
                }
              }
            }
          }
        }
      `,
      {variables: {ids: productIds}},
    );

    const data = await response.json();
    const nodes = data?.data?.nodes || [];

    for (const node of nodes) {
      if (!node?.id) continue;

      const target = products.find((p) => p.id === node.id);
      if (target) {
        const rawVariants = node.variants?.nodes || [];
        target.variants = rawVariants.map((v) => ({
          id: v.id,
          title: v.title || 'Default',
          price: formatMoney(v.price),
        }));
        target.variantId = target.variants[0]?.id || '';
        if (!target.price && target.variants[0]?.price) {
          target.price = target.variants[0].price;
        }
      }
    }
  } catch (err) {
    console.error('Failed to resolve missing product variants:', err);
  }
}

function formatProduct(product, storefrontUrl) {
  if (!product?.id) return null;

  const rawVariants = Array.isArray(product.variants)
    ? product.variants
    : Array.isArray(product.variants?.nodes)
    ? product.variants.nodes
    : [];

  const variants = rawVariants
    .filter((v) => v && (v.id || typeof v === 'string'))
    .map((v) => {
      const id = typeof v === 'string' ? v : v.id;
      const title = typeof v === 'object' && v.title ? v.title : 'Default';
      const price = typeof v === 'object' ? formatMoney(v.price) : '';
      return {id, title, price};
    });

  const defaultVariantId =
    product.variantId ||
    variants[0]?.id ||
    (typeof product.id === 'string' && product.id.includes('ProductVariant')
      ? product.id
      : '');

  const price = variants[0]?.price || formatMoney(product.price) || '';

  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    url:
      product.onlineStoreUrl ||
      buildProductUrl(storefrontUrl, product.handle),
    image: product.featuredImage?.url || product.image || '',
    variantId: defaultVariantId,
    price,
    variants,
  };
}

function formatMoney(priceObj) {
  if (!priceObj) return '';
  if (typeof priceObj === 'string') return priceObj.startsWith('$') ? priceObj : `$${priceObj}`;
  const amount = priceObj.amount || priceObj.shopMoney?.amount;
  if (amount) return `$${parseFloat(amount).toFixed(2)}`;
  return '';
}

function normalizeOrderId(orderId) {
  const value = String(orderId || '').trim();

  if (!value) return '';

  if (/^\d+$/.test(value)) {
    return `gid://shopify/Order/${value}`;
  }

  return value.replace(
    'gid://shopify/OrderIdentity/',
    'gid://shopify/Order/',
  );
}

function graphQLErrorMessage(data) {
  const message = data.errors
    .map((error) => error?.message)
    .filter(Boolean)
    .join(', ');

  return message || 'Could not load order from Shopify';
}

function matchesProductConditions(products, conditions) {
  if (!conditions.length) return true;

  return conditions.every((condition) => {
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
  return (product?.collections?.nodes || [])
    .flatMap((collection) => [
      collection?.id,
      collection?.handle,
      collection?.title,
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

function productSummary(product) {
  return {
    id: product.id,
    title: product.title,
  };
}

function normalizeToken(value) {
  return typeof value === 'string'
    ? value.trim().toLowerCase()
    : '';
}

function stringValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function responseJson(data) {
  return new Response(
    JSON.stringify(data),
    {
      status: 200,
      headers: {
        'Content-Type':
          'application/json',

        'Access-Control-Allow-Origin':
          '*',

        'Access-Control-Allow-Methods':
          'POST, OPTIONS',

        'Access-Control-Allow-Headers':
          'Content-Type',
      },
    },
  );
}

function buildProductUrl(storefrontUrl, handle) {
  if (!handle) {
    return storefrontUrl;
  }

  try {
    return new URL(
      `/products/${handle}`,
      storefrontUrl,
    ).toString();
  } catch {
    return `https://${storefrontUrl}/products/${handle}`;
  }
}

export async function loader() {
  return responseJson({});
}
