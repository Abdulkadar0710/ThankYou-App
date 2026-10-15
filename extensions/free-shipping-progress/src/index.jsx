/* global globalThis, shopify */
/* eslint react/prop-types: off */
import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useState} from 'preact/hooks';
import {fetchActiveBlock} from '../../shared/blocks';
import {claimExtensionRender} from '../../shared/render-once';
import {limitText, trimText} from '../../shared/text';
import {apiUrls} from '../../shared/app-config';

export default () => {
  try {
    if (!claimExtensionRender('free-shipping-progress')) return;

    render(<Extension />, document.body);
  } catch (error) {
    console.error('Free shipping progress failed to render:', error);
  }
};

function Extension() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState(null);
  const [thresholdLoading, setThresholdLoading] = useState(true);

  const api = extensionApi();
  const subtotal = useSignalValue(api?.cost?.subtotalAmount);
  const totalShipping = useSignalValue(api?.cost?.totalShippingAmount);
  const deliveryGroups = useSignalValue(api?.deliveryGroups);
  const shippingAddress = useSignalValue(api?.shippingAddress);

  useEffect(() => {
    let mounted = true;

    async function loadBlock() {
      try {
        const block = await fetchActiveBlock('freeShippingProgress');
        if (mounted) setConfig(block?.config || null);
      } catch (error) {
        console.error(error);
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

  const activeGroup = deliveryGroups?.[0];
  const selectedOptionHandle = activeGroup?.selectedDeliveryOption?.handle;
  const selectedOption = activeGroup?.deliveryOptions?.find(
    (opt) => opt.handle === selectedOptionHandle,
  );
  const selectedMethodTitle = selectedOption?.title || '';
  const countryCode =
    shippingAddress?.countryCode ||
    activeGroup?.deliveryAddress?.countryCode ||
    '';
  const provinceCode =
    shippingAddress?.provinceCode ||
    shippingAddress?.province ||
    activeGroup?.deliveryAddress?.provinceCode ||
    '';

  useEffect(() => {
    let mounted = true;

    async function loadThreshold() {
      setThresholdLoading(true);
      const shops = shopCandidates(api);
      const shop = shops[0] || '';

      if (!shop) {
        if (mounted) {
          setThreshold(null);
          setThresholdLoading(false);
        }
        return;
      }

      try {
        const val = await fetchShippingThreshold({
          shop,
          methodName: selectedMethodTitle,
          countryCode,
          provinceCode,
        });

        if (mounted) {
          setThreshold(val);
        }
      } catch (err) {
        if (mounted) {
          setThreshold(null);
        }
      } finally {
        if (mounted) {
          setThresholdLoading(false);
        }
      }
    }

    loadThreshold();

    return () => {
      mounted = false;
    };
  }, [selectedMethodTitle, countryCode, provinceCode]);

  if (loading || thresholdLoading) return null;
  if (!config) return null;

  // Do not add any fallback price: only show if an accurate min price required to unlock free delivery exists
  if (threshold === null || !Number.isFinite(threshold) || threshold <= 0) {
    return null;
  }

  const currentAmount = Math.max(0, Number(subtotal?.amount) || 0);
  const shippingAmount = Number(totalShipping?.amount);
  const currencyCode = totalShipping?.currencyCode || subtotal?.currencyCode || '';
  const remaining = Math.max(0, threshold - currentAmount);

  // Hide the free shipping block if free shipping is unlocked but the buyer selects a shipping option with extra cost (e.g., Standard $9.67)
  if (remaining <= 0 && Number.isFinite(shippingAmount) && shippingAmount > 0) {
    return null;
  }

  const progress =
    threshold > 0
      ? Math.max(0, Math.min(100, (currentAmount / threshold) * 100))
      : 100;
  const amount = formatMoney({amount: remaining, currencyCode});
  const heading = limitText(
    trimText(config.freeShippingHeading) || 'Free shipping',
    80,
  );
  const message =
    remaining <= 0
      ? trimText(config.freeShippingSuccessMessage) ||
        "You've unlocked free shipping."
      : (trimText(config.freeShippingRemainingMessage) ||
          "You're {amount} away from free shipping."
        ).split('{amount}').join(amount);

  return (
    <s-stack gap="small">
      <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="base">
        <s-text type="strong">{heading}</s-text>
        <s-text type="strong">{limitText(message, 120)}</s-text>
      </s-grid>
      <s-progress value={progress} max={100} />
    </s-stack>
  );
}

async function fetchShippingThreshold({shop, methodName, countryCode, provinceCode}) {
  const params = new URLSearchParams({shop});
  if (methodName) params.set('methodName', methodName);
  if (countryCode) params.set('countryCode', countryCode);
  if (provinceCode) params.set('provinceCode', provinceCode);

  const urls = apiUrls(`/api/shipping-threshold?${params.toString()}`);

  for (const url of urls) {
    try {
      const response = await fetch(url);
      const data = await response.json().catch(() => null);
      if (response.ok && data?.success) {
        return data.threshold !== undefined && data.threshold !== null
          ? Number(data.threshold)
          : null;
      }
    } catch (e) {
      // try next url
    }
  }

  return null;
}

function shopCandidates(extensionApi) {
  const shop = extensionApi?.shop || {};
  const values = [
    shop.myshopifyDomain,
    shop.domain,
    shop.storefrontUrl,
    shop.storefrontUrl?.current,
  ];

  return values
    .map(normalizeShop)
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index);
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

function extensionApi() {
  return typeof globalThis !== 'undefined' && globalThis.shopify
    ? globalThis.shopify
    : typeof shopify !== 'undefined'
    ? shopify
    : undefined;
}

function formatMoney(value) {
  const amount = Number(value?.amount);
  const currencyCode = value?.currencyCode;

  if (!Number.isFinite(amount)) return '';

  if (!currencyCode) return amount.toFixed(2);

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
    }).format(amount);
  } catch (error) {
    return `${amount.toFixed(2)} ${currencyCode}`;
  }
}
