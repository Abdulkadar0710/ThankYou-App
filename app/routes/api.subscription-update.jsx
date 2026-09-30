/* eslint-env node */
import {unauthenticated} from '../shopify.server';
import prisma from '../db.server';

export function cors(response) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization',
  );
  response.headers.set('Access-Control-Max-Age', '7200');
  return response;
}

function json(data, init = {}) {
  return cors(
    new Response(JSON.stringify(data), {
      status: init.status || 200,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    }),
  );
}

export async function loader({request}) {
  if (request.method === 'OPTIONS') {
    return cors(new Response(null, {status: 204}));
  }

  try {
    const url = new URL(request.url);
    const shop = normalizeShop(url.searchParams.get('shop') || process.env.SHOPIFY_SHOP_DOMAIN);
    const orderIdParam = url.searchParams.get('orderId') || '';
    const orderNumberParam = url.searchParams.get('orderNumber') || '';

    // If no orderId or previewing in Shopify Checkout Editor
    if (!orderIdParam && !orderNumberParam) {
      return json({
        success: true,
        preview: true,
        items: [
          {
            lineItemId: 'preview-item-1',
            productId: 'gid://shopify/Product/preview-1',
            productTitle: 'The Collection Snowboard: Oxygen',
            variantId: 'gid://shopify/ProductVariant/preview-1',
            variantTitle: '155cm',
            currentSellingPlan: {
              id: 'preview-plan-1',
              name: 'Deliver every 1st of month (50% off)',
            },
            availablePlans: [
              {
                id: 'preview-plan-1',
                name: 'Deliver every 1st of month (50% off)',
                description: 'Delivered on the 1st of each month',
              },
              {
                id: 'preview-plan-2',
                name: 'Deliver every 5th of 2 months (60% off)',
                description: 'Delivered on the 5th every 2 months',
              },
              {
                id: 'preview-plan-3',
                name: 'Deliver every 1 week (10% off)',
                description: 'Delivered every week',
              },
            ],
          },
        ],
      });
    }

    if (!shop) {
      return json({success: false, message: 'Shop is required'}, {status: 400});
    }

    const {admin} = await unauthenticated.admin(shop);

    let normalizedOrderId = normalizeOrderId(orderIdParam);
    let order = null;

    if (normalizedOrderId) {
      order = await fetchOrderSubscriptions(admin, normalizedOrderId);
    }

    if (!order && orderNumberParam) {
      const foundOrder = await findOrderByNumber(admin, orderNumberParam);
      if (foundOrder?.id) {
        order = await fetchOrderSubscriptions(admin, foundOrder.id);
        normalizedOrderId = foundOrder.id;
      }
    }

    if (!order) {
      return json({success: false, message: 'Order not found', items: []});
    }

    const customerId = order.customer?.id || '';

    // Look for any subscription contracts linked to this order or customer
    const contracts = await findSubscriptionContracts(admin, normalizedOrderId, customerId);

    console.log("Contracts: ", contracts);

    const items = [];
    const lineItems = order.lineItems?.nodes || [];

    for (const item of lineItems) {
      const product = item.product;
      const sellingPlanGroups = product?.sellingPlanGroups?.nodes || [];

      // Collect all available selling plans for this product
      const availablePlansMap = new Map();
      sellingPlanGroups.forEach((group) => {
        (group.sellingPlans?.nodes || []).forEach((plan) => {
          if (plan.id && !availablePlansMap.has(plan.id)) {
            availablePlansMap.set(plan.id, {
              id: plan.id,
              name: plan.name,
              description: plan.description || '',
              options: plan.options || [],
            });
          }
        });
      });

      const availablePlans = Array.from(availablePlansMap.values());

      // If the line item has a selling plan or the product offers subscription plans
      const currentPlanId = item.sellingPlan?.sellingPlanId || (availablePlans[0]?.id || '');
      const currentPlanName = item.sellingPlan?.name || (availablePlans[0]?.name || 'Standard Plan');

      // Check if there is an active subscription contract line for this product
      let matchingContract = null;
      let matchingContractLine = null;

      for (const contract of contracts) {
        const contractLines = contract.lines?.nodes || [];
        const foundLine = contractLines.find((l) => l.productId === product?.id);
        if (foundLine) {
          matchingContract = contract;
          matchingContractLine = foundLine;
          break;
        }
      }

      // Include this item if it has an active subscription or multiple plans available
      if (item.sellingPlan || matchingContract || availablePlans.length > 0) {
        items.push({
          lineItemId: item.id,
          productId: product?.id || '',
          productTitle: item.title || product?.title || 'Subscription Item',
          variantId: item.variant?.id || '',
          variantTitle: item.variant?.title || '',
          currentSellingPlan: {
            id: matchingContractLine?.sellingPlanId || currentPlanId,
            name: matchingContractLine?.sellingPlanName || currentPlanName,
          },
          contractId: matchingContract?.id || null,
          contractLineId: matchingContractLine?.id || null,
          availablePlans,
        });
      }
    }

    return json({
      success: true,
      items,
    });
  } catch (error) {
    console.error('Error fetching subscription items:', error);
    return json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal error',
        items: [],
      },
      {status: 500},
    );
  }
}

export async function action({request}) {
  if (request.method === 'OPTIONS') {
    return cors(new Response(null, {status: 204}));
  }

  try {
    const body = await parseRequestBody(request);
    const shop = normalizeShop(body.shop || process.env.SHOPIFY_SHOP_DOMAIN);
    const {
      orderId,
      orderNumber,
      productId,
      newSellingPlanId,
      newSellingPlanName,
    } = body;

    let {contractId, contractLineId} = body;

    if (!shop) {
      return json({success: false, message: 'Shop domain is required'}, {status: 400});
    }

    if (!newSellingPlanId) {
      return json({success: false, message: 'New selling plan ID is required'}, {status: 400});
    }

    // In preview / mock mode
    if (!orderId && !orderNumber) {
      return json({
        success: true,
        preview: true,
        message: `Subscription frequency updated to: ${newSellingPlanName || 'New Plan'}`,
      });
    }

    const {admin} = await unauthenticated.admin(shop);

    // If contractId wasn't passed directly, look it up by order or product
    if (!contractId) {
      const normalizedOrderId = normalizeOrderId(orderId);
      const contracts = await findSubscriptionContracts(admin, normalizedOrderId, '');
      const matched = contracts.find((c) =>
        productId ? c.lines?.nodes?.some((l) => l.productId === productId) : true,
      );

      if (matched) {
        contractId = matched.id;
        const line = matched.lines?.nodes?.find((l) => l.productId === productId) || matched.lines?.nodes?.[0];
        contractLineId = line?.id || null;
      }
    }

    // If we have a live subscription contract to update
    if (contractId) {
      const updateResult = await updateSubscriptionContractSellingPlan(
        admin,
        contractId,
        contractLineId,
        newSellingPlanId,
        newSellingPlanName,
      );

      if (!updateResult.success) {
        return json({
          success: false,
          message: updateResult.message || 'Could not update subscription contract',
        });
      }
    }

    // Record the subscription update in database analytics
    try {
      await prisma.subscriptionClick.create({
        data: {
          shop,
          eventType: 'subscription_plan_update',
          orderId: String(orderId || ''),
          orderNumber: String(orderNumber || ''),
          ctaText: newSellingPlanName || 'Update Plan',
          itemId: String(productId || newSellingPlanId),
          itemTitle: newSellingPlanName || 'Subscription Update',
          source: 'thank_you_subscription_update',
          payload: JSON.stringify(body),
        },
      });
    } catch {
      // non-fatal tracking error
    }

    return json({
      success: true,
      message: `Your subscription schedule has been updated to: ${newSellingPlanName || 'New Plan'}`,
    });
  } catch (error) {
    console.error('Error in subscription update action:', error);
    return json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Could not update subscription',
      },
      {status: 500},
    );
  }
}

async function fetchOrderSubscriptions(admin, orderId) {
  const query = `
    query GetOrderSubscriptions($id: ID!) {
      order(id: $id) {
        id
        name
        customer {
          id
        }
        lineItems(first: 20) {
          nodes {
            id
            title
            quantity
            variant {
              id
              title
              price
            }
            product {
              id
              title
              sellingPlanGroups(first: 5) {
                nodes {
                  id
                  name
                  sellingPlans(first: 10) {
                    nodes {
                      id
                      name
                      description
                      options
                    }
                  }
                }
              }
            }
            sellingPlan {
              name
              sellingPlanId
            }
          }
        }
      }
    }
  `;

  const response = await admin.graphql(query, {variables: {id: orderId}});
  const jsonResult = await response.json();
  return jsonResult?.data?.order || null;
}

async function findOrderByNumber(admin, orderNumber) {
  const query = `
    query FindOrder($query: String!) {
      orders(first: 1, query: $query) {
        nodes {
          id
          name
        }
      }
    }
  `;

  const cleanNum = String(orderNumber).replace(/[^0-9]/g, '');
  const response = await admin.graphql(query, {
    variables: {query: `name:#${cleanNum} OR name:${cleanNum}`},
  });
  const jsonResult = await response.json();
  return jsonResult?.data?.orders?.nodes?.[0] || null;
}

async function findSubscriptionContracts(admin, orderId, customerId) {
  const query = `
    query GetCustomerSubscriptions($query: String!) {
      subscriptionContracts(first: 10, query: $query) {
        nodes {
          id
          status
          originOrder {
            id
            name
          }
          lines(first: 10) {
            nodes {
              id
              productId
              sellingPlanId
              sellingPlanName
              quantity
              currentPrice {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  `;

  try {
    let searchQuery = '';
    if (customerId) {
      const cleanCustomerId = customerId.replace('gid://shopify/Customer/', '');
      searchQuery = `customer_id:${cleanCustomerId}`;
    }

    const response = await admin.graphql(query, {variables: {query: searchQuery}});
    const jsonResult = await response.json();
    const contracts = jsonResult?.data?.subscriptionContracts?.nodes || [];

    if (orderId && contracts.length > 0) {
      const matchedByOrder = contracts.filter(
        (c) => c.originOrder?.id === orderId || c.originOrder?.name === orderId,
      );
      if (matchedByOrder.length > 0) return matchedByOrder;
    }

    return contracts;
  } catch (e) {
    console.error('Failed to query subscription contracts:', e);
    return [];
  }
}

async function updateSubscriptionContractSellingPlan(
  admin,
  contractId,
  contractLineId,
  newSellingPlanId,
  newSellingPlanName,
) {
  console.log("contractId: ", contractId);
  console.log("contractLineId: ", contractLineId);
  // Step 1: Open draft
  const draftMutation = `
    mutation SubscriptionContractUpdate($contractId: ID!) {
      subscriptionContractUpdate(contractId: $contractId) {
        draft {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const draftRes = await admin.graphql(draftMutation, {variables: {contractId}});
  const draftJson = await draftRes.json();
  const draftId = draftJson?.data?.subscriptionContractUpdate?.draft?.id;
  const draftErrors = draftJson?.data?.subscriptionContractUpdate?.userErrors || [];

  if (!draftId) {
    return {
      success: false,
      message: draftErrors[0]?.message || 'Failed to create subscription contract draft.',
    };
  }

  // Step 2: Fetch selling plan details to update delivery/billing policies if applicable
  const planQuery = `
    query GetSellingPlan($id: ID!) {
      sellingPlan: node(id: $id) {
        ... on SellingPlan {
          id
          name
          billingPolicy {
            ... on SellingPlanRecurringBillingPolicy {
              interval
              intervalCount
            }
          }
          deliveryPolicy {
            ... on SellingPlanRecurringDeliveryPolicy {
              interval
              intervalCount
            }
          }
        }
      }
    }
  `;

  let sellingPlanDetails = null;
  try {
    const planRes = await admin.graphql(planQuery, {variables: {id: newSellingPlanId}});
    const planJson = await planRes.json();
    sellingPlanDetails = planJson?.data?.sellingPlan || null;
  } catch (e) {
    console.warn('Could not load selling plan details:', e);
  }

  // Step 3: Update line in draft if lineId is known
  if (contractLineId) {
    const lineUpdateMutation = `
      mutation SubscriptionDraftLineUpdate($draftId: ID!, $lineId: ID!, $input: SubscriptionLineUpdateInput!) {
        subscriptionDraftLineUpdate(draftId: $draftId, lineId: $lineId, input: $input) {
          draft {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    await admin.graphql(lineUpdateMutation, {
      variables: {
        draftId,
        lineId: contractLineId,
        input: {
          sellingPlanId: newSellingPlanId,
          sellingPlanName: newSellingPlanName || sellingPlanDetails?.name || '',
        },
      },
    });
  }

  // Step 4: If selling plan has delivery policy / billing policy, update the draft policies
  if (sellingPlanDetails?.deliveryPolicy?.interval || sellingPlanDetails?.billingPolicy?.interval) {
    const draftUpdateMutation = `
      mutation SubscriptionDraftUpdate($draftId: ID!, $input: SubscriptionDraftInput!) {
        subscriptionDraftUpdate(draftId: $draftId, input: $input) {
          draft {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const draftInput = {};
    if (sellingPlanDetails.deliveryPolicy?.interval && sellingPlanDetails.deliveryPolicy?.intervalCount) {
      draftInput.deliveryPolicy = {
        interval: sellingPlanDetails.deliveryPolicy.interval,
        intervalCount: sellingPlanDetails.deliveryPolicy.intervalCount,
      };
    }
    if (sellingPlanDetails.billingPolicy?.interval && sellingPlanDetails.billingPolicy?.intervalCount) {
      draftInput.billingPolicy = {
        interval: sellingPlanDetails.billingPolicy.interval,
        intervalCount: sellingPlanDetails.billingPolicy.intervalCount,
      };
    }

    if (Object.keys(draftInput).length > 0) {
      try {
        await admin.graphql(draftUpdateMutation, {
          variables: {
            draftId,
            input: draftInput,
          },
        });
      } catch (err) {
        console.warn('Failed to update draft policy intervals:', err);
      }
    }
  }

  // Step 5: Commit draft
  const commitMutation = `
    mutation SubscriptionDraftCommit($draftId: ID!) {
      subscriptionDraftCommit(draftId: $draftId) {
        contract {
          id
          status
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const commitRes = await admin.graphql(commitMutation, {variables: {draftId}});
  const commitJson = await commitRes.json();
  const commitErrors = commitJson?.data?.subscriptionDraftCommit?.userErrors || [];

  if (commitErrors.length > 0) {
    return {
      success: false,
      message: commitErrors[0]?.message || 'Could not commit subscription update.',
    };
  }

  return {success: true};
}

function normalizeShop(value) {
  if (!value) return '';
  const text = String(value).trim();
  try {
    return new URL(text).hostname.toLowerCase();
  } catch {
    return text.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
  }
}

function normalizeOrderId(orderId) {
  if (!orderId) return '';
  const str = String(orderId).trim();
  if (str.startsWith('gid://shopify/Order/')) return str;
  const num = str.replace(/[^0-9]/g, '');
  return num ? `gid://shopify/Order/${num}` : '';
}

async function parseRequestBody(request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return request.json();
  }
  const text = await request.text();
  return text ? JSON.parse(text) : {};
}
