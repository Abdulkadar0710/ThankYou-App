import type {StandardApi} from '@shopify/ui-extensions/checkout';

declare global {
  const shopify: StandardApi<'purchase.thank-you.block.render'>;
}

export {};
