/* global globalThis, process */

import {apiUrls} from './app-config';

export function trackThankYouClick(eventType, details = {}) {
  try {
    const extensionApi =
      typeof globalThis !== 'undefined' ? globalThis.shopify : shopify;
    const orderConfirmation = extensionApi?.orderConfirmation?.current;
    const payload = {
      eventType,
      shop: details.shop || shopDomain(extensionApi?.shop),
      orderId: signalValue(orderConfirmation?.order?.id) || null,
      orderNumber: signalValue(orderConfirmation?.number) || null,
      source: details.source || (orderConfirmation ? `thank_you_${eventType}` : `checkout_${eventType}`),
      ...details,
    };

    // Publish to Shopify analytics - silent fail
    extensionApi?.analytics?.publish(
      `thankyou_app:${eventType}`,
      payload,
    )?.catch(() => {
      // Silent fail - analytics should never break UX
    });

    // Send to backend - silent fail
    sendAnalytics(payload);
  } catch (error) {
    // Silent fail - analytics should never break functionality
    // Only log in development
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      console.warn('Analytics tracking failed:', error);
    }
  }
}

export const trackClick = trackThankYouClick;

async function sendAnalytics(payload) {
  for (const url of apiUrls('/api/analytics-click')) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify(payload),
        keepalive: true,
      });
      const data = await response.json().catch(() => null);

      if (response.ok && data?.success) return;
    } catch (error) {
      // Try the next configured app URL.
    }
  }
}

function shopDomain(shop) {
  return firstNormalized([
    shop?.myshopifyDomain,
    shop?.myshopifyDomain?.current,
    shop?.myshopifyDomain?.value,
    shop?.domain,
    shop?.domain?.current,
    shop?.domain?.value,
    shop?.storefrontUrl,
    shop?.storefrontUrl?.current,
    shop?.storefrontUrl?.value,
  ]);
}

function signalValue(value) {
  return value?.current || value?.value || value;
}

function firstNormalized(values) {
  const value = values.map(signalValue).find(Boolean);

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
