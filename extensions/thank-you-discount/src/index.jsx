import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useState} from 'preact/hooks';
import {limitText, trimText} from '../../shared/text';
import {fetchActiveBlock} from '../../shared/blocks';
import {claimExtensionRender} from '../../shared/render-once';

export default () => {
  try {
    if (!claimExtensionRender('discount')) return;

    render(<Extension />, document.body);
  } catch (error) {
    console.error('Extension failed to render:', error);
    // Graceful fallback - render nothing rather than breaking page
  }
};

function Extension() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchActiveBlock('discount')
      .then((block) => setConfig(block?.config || null))
      .catch((error) => {
        console.error(error);
        setConfig(null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <s-box padding="base" border="base" borderRadius="base">
        <s-stack gap="small">
          <s-skeleton-paragraph />
          <s-skeleton-paragraph />
        </s-stack>
      </s-box>
    );
  }

  if (!config) return null;

  const title = limitText(
    trimText(config.title) || 'Discount code',
    48,
  );
  const description = limitText(
    textFromHtml(config.description) || 'Use this code on your next purchase:',
    120,
  );
  const discountCode = limitText(
    trimText(config.discountCode),
    32,
  );

  if (!discountCode) return null;

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(discountCode);
      } else if (typeof document !== 'undefined') {
        const textArea = document.createElement('textarea');
        textArea.value = discountCode;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy discount code:', err);
    }
  };

  return (
    <s-box padding="base" border="base" borderRadius="base">
      <s-stack gap="small">
        <s-text type="strong">{title}</s-text>

        <s-text>
          {description}
        </s-text>

        <s-grid gridTemplateColumns="1fr auto" gap="small" alignItems="center">
          <s-box padding="small" border="base" borderRadius="base">
            <s-text type="strong">{discountCode}</s-text>
          </s-box>
          <s-button
            onClick={handleCopy}
            accessibilityLabel="Copy discount code"
          >
            {copied ? 'Copied!' : 'Copy code'}
          </s-button>
        </s-grid>
      </s-stack>
    </s-box>
  );
}

function textFromHtml(value) {
  return trimText(String(value || '').replace(/<[^>]*>/g, ' '));
}
