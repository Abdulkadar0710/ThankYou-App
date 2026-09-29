import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {claimExtensionRender} from '../../shared/render-once';

export default () => {
  try {
    if (!claimExtensionRender('subscription-update')) return;

    render(<Extension />, document.body);
  } catch (error) {
    console.error('Subscription Update extension failed to render:', error);
  }
};

function Extension() {
  return (
    <s-banner heading="Subscription Update">
      <s-text>Subscription Update</s-text>
    </s-banner>
  );
}
