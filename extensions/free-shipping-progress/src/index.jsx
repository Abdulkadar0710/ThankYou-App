/* global globalThis */
/* eslint react/prop-types: off */
import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useState} from 'preact/hooks';
import {fetchActiveBlock} from '../../shared/blocks';
import {claimExtensionRender} from '../../shared/render-once';
import {limitText, trimText} from '../../shared/text';

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
  const api = extensionApi();
  const subtotal = useSignalValue(api?.cost?.subtotalAmount);
  const totalShipping = useSignalValue(api?.cost?.totalShippingAmount);

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

  if (loading) {
    return (
      <s-box padding="base" border="base" borderRadius="base">
        <s-skeleton-paragraph />
      </s-box>
    );
  }

  if (!config) return null;

  const currentAmount = Math.max(0, Number(subtotal?.amount) || 0);
  const shippingAmount = Number(totalShipping?.amount);
  const threshold = Number(2000); 

  if (!Number.isFinite(threshold) || threshold < 0) return null;

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
  return typeof globalThis !== 'undefined' ? globalThis.shopify : shopify;
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
