/* eslint-env node */
import {unauthenticated} from '../shopify.server';

export async function action({request}) {
  try {
    if (request.method === 'OPTIONS') {
      return responseJson({});
    }

    const body = await parseRequestBody(request);
    const {orderId, quantity = 1} = body;
    const shop = normalizeShop(body.shop || process.env.SHOPIFY_SHOP_DOMAIN);

    if (!shop) {
      return responseJson({
        success: false,
        message: 'Shop domain is required to edit order',
      });
    }

    if (!orderId && !body.checkoutToken && !body.orderNumber) {
      return responseJson({
        success: false,
        message: 'Order details required to add item to order',
      });
    }

    const {admin} = await unauthenticated.admin(shop);

    // Step 0: Resolve variant ID automatically if variantId is missing or points to a Product
    const resolvedVariantId = await resolveVariantId(admin, body);

    if (!resolvedVariantId) {
      return responseJson({
        success: false,
        message: 'No variant ID found for this product',
      });
    }

    let normalizedOrderId = normalizeOrderId(orderId);
    const normalizedVariantId = normalizeVariantId(resolvedVariantId);
    const parsedQuantity = Math.max(1, parseInt(quantity, 10) || 1);

    // If orderId is missing or couldn't be normalized, lookup order by checkout token or order number
    if (!normalizedOrderId && (body.checkoutToken || body.orderNumber)) {
      const foundOrder = await findOrderByQuery(admin, body.checkoutToken, body.orderNumber);
      if (foundOrder?.id) {
        normalizedOrderId = foundOrder.id;
      }
    }

    if (!normalizedOrderId) {
      return responseJson({
        success: false,
        message: 'Order not found',
      });
    }

    // Step 1: Begin order edit session
    let beginData = await graphqlJson(
      admin,
      `
        mutation OrderEditBegin($id: ID!) {
          orderEditBegin(id: $id) {
            calculatedOrder {
              id
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      {id: normalizedOrderId},
    );

    let beginErrors = beginData?.data?.orderEditBegin?.userErrors || [];
    let calculatedOrderId = beginData?.data?.orderEditBegin?.calculatedOrder?.id;

    // Fallback order resolution if direct orderId failed
    if ((!calculatedOrderId || beginErrors.length || beginData?.errors?.length) && (body.checkoutToken || body.orderNumber)) {
      const fallbackOrder = await findOrderByQuery(admin, body.checkoutToken, body.orderNumber);
      if (fallbackOrder?.id && fallbackOrder.id !== normalizedOrderId) {
        normalizedOrderId = fallbackOrder.id;
        beginData = await graphqlJson(
          admin,
          `
            mutation OrderEditBegin($id: ID!) {
              orderEditBegin(id: $id) {
                calculatedOrder {
                  id
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          {id: normalizedOrderId},
        );
        beginErrors = beginData?.data?.orderEditBegin?.userErrors || [];
        calculatedOrderId = beginData?.data?.orderEditBegin?.calculatedOrder?.id;
      }
    }

    if (beginData?.errors?.length) {
      return responseJson({
        success: false,
        message: graphQLErrorMessage(beginData),
      });
    }

    if (beginErrors.length || !calculatedOrderId) {
      return responseJson({
        success: false,
        message:
          beginErrors.map((e) => e.message).join(' ') ||
          'Order editing is not available for this order.',
      });
    }

    // Step 2: Add variant line item to calculated order (0 extra shipping fee)
    const addData = await graphqlJson(
      admin,
      `
        mutation OrderEditAddVariant($id: ID!, $variantId: ID!, $quantity: Int!) {
          orderEditAddVariant(id: $id, variantId: $variantId, quantity: $quantity) {
            calculatedLineItem {
              id
              quantity
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      {
        id: calculatedOrderId,
        variantId: normalizedVariantId,
        quantity: parsedQuantity,
      },
    );

    const addErrors = addData?.data?.orderEditAddVariant?.userErrors || [];

    if (addData?.errors?.length) {
      return responseJson({
        success: false,
        message: graphQLErrorMessage(addData),
      });
    }

    if (addErrors.length) {
      return responseJson({
        success: false,
        message: addErrors.map((e) => e.message).join(' '),
      });
    }

    // Step 3: Commit order edit changes
    const commitData = await graphqlJson(
      admin,
      `
        mutation OrderEditCommit($id: ID!, $notifyCustomer: Boolean) {
          orderEditCommit(id: $id, notifyCustomer: $notifyCustomer) {
            order {
              id
              name
              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      {
        id: calculatedOrderId,
        notifyCustomer: false,
      },
    );

    const commitErrors = commitData?.data?.orderEditCommit?.userErrors || [];

    if (commitData?.errors?.length) {
      return responseJson({
        success: false,
        message: graphQLErrorMessage(commitData),
      });
    }

    if (commitErrors.length) {
      return responseJson({
        success: false,
        message: commitErrors.map((e) => e.message).join(' '),
      });
    }

    const updatedOrder = commitData?.data?.orderEditCommit?.order;

    return responseJson({
      success: true,
      message: 'Item added to your package with 0 extra shipping fee!',
      order: updatedOrder,
    });
  } catch (error) {
    console.error('Add to order error:', error);

    return responseJson({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : 'Could not add item to order. Please try again.',
    });
  }
}

export async function loader() {
  return responseJson({});
}

async function findOrderByQuery(admin, checkoutToken, orderNumber) {
  if (checkoutToken) {
    try {
      const data = await graphqlJson(
        admin,
        `
          query FindOrderByCheckoutToken($query: String!) {
            orders(first: 1, query: $query, sortKey: CREATED_AT, reverse: true) {
              nodes {
                id
              }
            }
          }
        `,
        {query: `checkout_token:${checkoutToken}`},
      );
      const node = data?.data?.orders?.nodes?.[0];
      if (node?.id) return node;
    } catch (err) {
      console.error('Failed to query order by checkout token:', err);
    }
  }

  if (orderNumber) {
    try {
      const q = String(orderNumber).startsWith('#')
        ? `name:${orderNumber}`
        : `name:#${orderNumber}`;
      const data = await graphqlJson(
        admin,
        `
          query FindOrderByOrderNumber($query: String!) {
            orders(first: 1, query: $query, sortKey: CREATED_AT, reverse: true) {
              nodes {
                id
              }
            }
          }
        `,
        {query: q},
      );
      const node = data?.data?.orders?.nodes?.[0];
      if (node?.id) return node;
    } catch (err) {
      console.error('Failed to query order by order number:', err);
    }
  }

  return null;
}

async function resolveVariantId(admin, body) {
  const {variantId, productId, itemId} = body;
  const candidate = variantId || productId || itemId || '';

  if (!candidate) return '';

  const candidateStr = String(candidate).trim();

  // If candidate is already a ProductVariant GID, return it directly
  if (candidateStr.includes('/ProductVariant/')) {
    return normalizeVariantId(candidateStr);
  }

  // If candidate is a Product GID or numeric ID, query Shopify for the product's first variant
  const productGid = normalizeGid(candidateStr, 'Product');

  try {
    const data = await graphqlJson(
      admin,
      `
        query GetProductVariant($id: ID!) {
          product(id: $id) {
            id
            variants(first: 1) {
              nodes {
                id
              }
            }
          }
        }
      `,
      {id: productGid},
    );

    const fetchedVariantId = data?.data?.product?.variants?.nodes?.[0]?.id;
    if (fetchedVariantId) {
      return fetchedVariantId;
    }
  } catch (err) {
    console.error('Failed to resolve variant from product ID:', err);
  }

  // Fallback: Return formatted GID
  return normalizeVariantId(candidateStr);
}

async function graphqlJson(admin, query, variables) {
  const response = await admin.graphql(query, {variables});
  return response.json();
}

async function parseRequestBody(request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return request.json();
  }

  const text = await request.text();
  return text ? JSON.parse(text) : {};
}

function normalizeShop(value) {
  if (!value) return '';
  const text = String(value).trim();
  if (!text) return '';
  try {
    return new URL(text).hostname.toLowerCase();
  } catch (error) {
    return text
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .toLowerCase();
  }
}

function normalizeOrderId(orderId) {
  const value = String(orderId || '').trim();
  if (!value) return '';

  if (/^\d+$/.test(value)) {
    return `gid://shopify/Order/${value}`;
  }

  const clean = value.replace('gid://shopify/OrderIdentity/', 'gid://shopify/Order/');
  if (clean.startsWith('gid://shopify/Order/')) {
    return clean;
  }

  const matches = clean.match(/\/(\d+)$/);
  if (matches) {
    return `gid://shopify/Order/${matches[1]}`;
  }

  return clean.startsWith('gid://shopify/') ? clean : `gid://shopify/Order/${clean}`;
}

function normalizeVariantId(variantId) {
  const value = String(variantId || '').trim();
  if (!value) return '';

  if (/^\d+$/.test(value)) {
    return `gid://shopify/ProductVariant/${value}`;
  }

  if (value.startsWith('gid://shopify/ProductVariant/')) {
    return value;
  }

  const matches = value.match(/\/(\d+)$/);
  if (matches) {
    return `gid://shopify/ProductVariant/${matches[1]}`;
  }

  return value;
}

function normalizeGid(id, type) {
  const value = String(id || '').trim();
  if (!value) return '';

  if (/^\d+$/.test(value)) {
    return `gid://shopify/${type}/${value}`;
  }

  const clean = value.replace('gid://shopify/OrderIdentity/', 'gid://shopify/Order/');
  if (clean.startsWith(`gid://shopify/${type}/`)) {
    return clean;
  }

  const matches = clean.match(/\/(\d+)$/);
  if (matches) {
    return `gid://shopify/${type}/${matches[1]}`;
  }

  return clean;
}

function graphQLErrorMessage(data) {
  return (
    data?.errors
      ?.map((error) => error.message)
      .filter(Boolean)
      .join(' ') || 'Shopify Admin API request failed.'
  );
}

function responseJson(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
