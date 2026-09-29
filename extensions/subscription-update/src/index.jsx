/* global globalThis */
import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useState} from 'preact/hooks';
import {claimExtensionRender} from '../../shared/render-once';
import {apiUrls} from '../../shared/app-config';
import {fetchActiveBlock} from '../../shared/blocks';

export default () => {
  try {
    if (!claimExtensionRender('subscription-update')) return;

    render(<Extension />, document.body);
  } catch (error) {
    console.error('Subscription Update extension failed to render:', error);
  }
};

function Extension() {
  const [config, setConfig] = useState(null);
  const [items, setItems] = useState([]);
  const [selectedPlans, setSelectedPlans] = useState({});
  const [loading, setLoading] = useState(true);
  const [submittingItem, setSubmittingItem] = useState(null);
  const [statusMap, setStatusMap] = useState({});

  const extensionApi =
    typeof globalThis !== 'undefined' ? globalThis.shopify : shopify;
  const orderConfirmation = extensionApi?.orderConfirmation?.current;
  const orderId = signalValue(orderConfirmation?.order?.id);
  const orderNumber = signalValue(orderConfirmation?.number);
  const shop = shopDomain(extensionApi?.shop);

  useEffect(() => {
    // 1. Fetch merchant block configuration
    fetchActiveBlock('subscriptionUpdate')
      .then((block) => setConfig(block?.config || null))
      .catch(() => setConfig(null));

    // 2. Fetch subscription items and available selling plans from backend API
    fetchSubscriptionDetails(shop, orderId, orderNumber)
      .then((data) => {
        if (data?.success && Array.isArray(data.items) && data.items.length > 0) {
          setItems(data.items);
          const initialSelections = {};
          data.items.forEach((item) => {
            initialSelections[item.lineItemId] =
              item.currentSellingPlan?.id || item.availablePlans?.[0]?.id || '';
          });
          setSelectedPlans(initialSelections);
        } else {
          setItems([]);
        }
      })
      .catch((err) => {
        console.error('Failed to load subscription items:', err);
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, [shop, orderId, orderNumber]);

  if (loading) {
    return (
      <s-box padding="base" border="base" borderRadius="base">
        <s-stack gap="base">
          <s-skeleton-paragraph />
          <s-skeleton-paragraph />
        </s-stack>
      </s-box>
    );
  }

  // Gracefully render nothing if no subscription items exist
  if (!items.length) {
    return null;
  }

  const headingText = config?.heading?.trim() || 'Subscription Schedule';
  const descriptionText =
    config?.description?.trim() ||
    'Need to change how often your order arrives? Select an available delivery frequency below.';
  const buttonText = config?.buttonText?.trim() || 'Update Frequency';
  const successText =
    config?.successMessage?.trim() ||
    'Your subscription plan has been updated successfully!';

  const handlePlanChange = (lineItemId, newPlanId) => {
    setSelectedPlans((prev) => ({
      ...prev,
      [lineItemId]: newPlanId,
    }));
    // Clear previous status for this item
    setStatusMap((prev) => ({
      ...prev,
      [lineItemId]: null,
    }));
  };

  const handleUpdate = async (item) => {

    console.log("Item: ", item);

    const selectedPlanId = selectedPlans[item.lineItemId];
    const targetPlan = item.availablePlans.find((p) => p.id === selectedPlanId);

    if (!selectedPlanId || selectedPlanId === item.currentSellingPlan?.id) {
      return;
    }

    setSubmittingItem(item.lineItemId);
    setStatusMap((prev) => ({...prev, [item.lineItemId]: null}));

    // In demo / preview mode without real order:
    if (!orderId || item.lineItemId === 'preview-item-1') {
      setTimeout(() => {
        setItems((prev) =>
          prev.map((i) =>
            i.lineItemId === item.lineItemId
              ? {
                  ...i,
                  currentSellingPlan: {
                    id: selectedPlanId,
                    name: targetPlan?.name || selectedPlanId,
                  },
                }
              : i,
          ),
        );
        setStatusMap((prev) => ({
          ...prev,
          [item.lineItemId]: {
            tone: 'success',
            message: `${successText} (Updated to: ${targetPlan?.name || selectedPlanId})`,
          },
        }));
        setSubmittingItem(null);
      }, 500);
      return;
    }

    try {
      const payload = {
        shop,
        orderId,
        orderNumber,
        contractId: item.contractId,
        contractLineId: item.contractLineId,
        productId: item.productId,
        variantId: item.variantId,
        lineItemId: item.lineItemId,
        newSellingPlanId: selectedPlanId,
        newSellingPlanName: targetPlan?.name || selectedPlanId,
        productTitle: item.productTitle,
      };

      const result = await submitSubscriptionUpdate(payload);
      console.log("result: ", result);

      if (result?.success) {
        // Update item's current plan in local state
        setItems((prev) =>
          prev.map((i) =>
            i.lineItemId === item.lineItemId
              ? {
                  ...i,
                  currentSellingPlan: {
                    id: selectedPlanId,
                    name: targetPlan?.name || selectedPlanId,
                  },
                }
              : i,
          ),
        );
        setStatusMap((prev) => ({
          ...prev,
          [item.lineItemId]: {
            tone: 'success',
            message: `${successText} Updated to: ${targetPlan?.name || selectedPlanId}`,
          },
        }));
      } else {
        setStatusMap((prev) => ({
          ...prev,
          [item.lineItemId]: {
            tone: 'critical',
            message: result?.message || 'Could not update plan at this time.',
          },
        }));
      }
    } catch (err) {
      setStatusMap((prev) => ({
        ...prev,
        [item.lineItemId]: {
          tone: 'critical',
          message: err?.message || 'An error occurred while updating your subscription.',
        },
      }));
    } finally {
      setSubmittingItem(null);
    }
  };

  return (
    <s-stack gap="base">
      {items.map((item) => {
        const selectedPlanId = selectedPlans[item.lineItemId] || item.currentSellingPlan?.id;
        const isCurrentPlan = selectedPlanId === item.currentSellingPlan?.id;
        const isSubmitting = submittingItem === item.lineItemId;
        const status = statusMap[item.lineItemId];

        return (
          <s-box key={item.lineItemId} padding="base" border="base" borderRadius="base">
            <s-stack gap="base">
              <s-stack gap="small">
                <s-text type="strong">{headingText}</s-text>
                <s-text tone="auto">{descriptionText}</s-text>
              </s-stack>

              <s-stack gap="small">
                <s-text type="strong">{item.productTitle}</s-text>
                {item.variantTitle && item.variantTitle !== 'Default Title' && (
                  <s-text tone="auto">{item.variantTitle}</s-text>
                )}

                <s-badge tone="neutral">
                  Current: {item.currentSellingPlan?.name || 'Standard Plan'}
                </s-badge>
              </s-stack>

              {item.availablePlans && item.availablePlans.length > 0 ? (
                <s-stack gap="base">
                  <s-select
                    label="Choose new delivery frequency"
                    value={selectedPlanId}
                    onChange={(e) => {
                      const eventTarget = /** @type {any} */ (e)?.target;
                      const val = eventTarget?.value || '';
                      handlePlanChange(item.lineItemId, val);
                    }}
                  >
                    {item.availablePlans.map((plan) => (
                      <s-option key={plan.id} value={plan.id}>
                        {plan.name}
                      </s-option>
                    ))}
                  </s-select>

                  <s-button
                    disabled={isSubmitting || isCurrentPlan}
                    onClick={() => handleUpdate(item)}
                  >
                    {isSubmitting ? 'Updating...' : buttonText}
                  </s-button>
                </s-stack>
              ) : (
                <s-text tone="auto">No other subscription frequencies available for this product.</s-text>
              )}

              {status && (
                <s-banner tone={status.tone}>
                  <s-text>{status.message}</s-text>
                </s-banner>
              )}
            </s-stack>
          </s-box>
        );
      })}
    </s-stack>
  );
}

async function fetchSubscriptionDetails(shop, orderId, orderNumber) {
  const queryParams = new URLSearchParams({
    shop: shop || '',
    orderId: orderId || '',
    orderNumber: orderNumber || '',
  });

  for (const url of apiUrls(`/api/subscription-update?${queryParams.toString()}`)) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {'Content-Type': 'application/json'},
      });
      if (response.ok) {
        return await response.json();
      }
    } catch {
      // try fallback URL
    }
  }
  return {success: false};
}

async function submitSubscriptionUpdate(payload) {

  console.log("Payload: ", payload);

  for (const url of apiUrls('/api/subscription-update')) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.success) {
        return data;
      }
      if (data?.message) {
        return data;
      }
    } catch {
      // try fallback URL
    }
  }
  return {success: false, message: 'Could not connect to app server.'};
}

function signalValue(value) {
  return value?.current || value;
}

function shopDomain(shop) {
  const values = [
    shop?.myshopifyDomain,
    shop?.domain,
    shop?.storefrontUrl,
    shop?.storefrontUrl?.current,
  ];
  const value = values.map(signalValue).find(Boolean);
  if (!value) return '';
  const text = String(value).trim();
  try {
    return new URL(text).hostname.toLowerCase();
  } catch {
    return text.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
  }
}
