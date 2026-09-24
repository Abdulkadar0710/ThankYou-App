/* global globalThis */
import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useState} from 'preact/hooks';
import {fetchActiveBlock} from '../../shared/blocks';
import {claimExtensionRender} from '../../shared/render-once';
import {trackThankYouClick} from '../../shared/analytics';

export default () => {
  try {
    if (!claimExtensionRender('howDidYouHear')) return;

    render(<Extension />, document.body);
  } catch (error) {
    console.error('Extension failed to render:', error);
  }
};

function Extension() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedOption, setSubmittedOption] = useState('');

  const extensionApi =
    typeof globalThis !== 'undefined' ? globalThis.shopify : shopify;
  const orderConfirmation = extensionApi?.orderConfirmation?.current;
  const orderId = signalValue(orderConfirmation?.order?.id);

  useEffect(() => {
    // Check if customer already submitted for this order
    if (orderId && typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const saved = window.sessionStorage.getItem(`hdyh_${orderId}`);
        if (saved) {
          setSubmitted(true);
          setSubmittedOption(saved);
        }
      } catch (e) {
        // Ignore sessionStorage restrictions
      }
    }

    fetchActiveBlock('howDidYouHear')
      .then((block) => setConfig(block?.config || null))
      .catch((error) => {
        console.error(error);
        setConfig(null);
      })
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) {
    return (
      <s-box padding="base" border="base" borderRadius="base">
        <s-stack gap="small">
          <s-skeleton-paragraph />
        </s-stack>
      </s-box>
    );
  }

  if (!config) return null;

  const heading = config.heading?.trim() || 'How did you hear about us?';
  const rawOptions = Array.isArray(config.options) && config.options.length
    ? config.options
    : ['Social Media', 'Ads', 'Search Engine', 'Friend or Family', 'Other'];
  const options = rawOptions
    .map((opt) => (typeof opt === 'string' ? opt.trim() : ''))
    .filter(Boolean);

  if (!options.length) return null;

  const buttonText = config.buttonText?.trim() || 'Submit';
  const successMessage =
    config.successMessage?.trim() || 'Thank you for your feedback!';

  const handleSubmit = () => {
    if (!selectedOption || submitting) return;

    setSubmitting(true);

    try {
      trackThankYouClick('how_did_you_hear', {
        selectedOption,
        ctaText: selectedOption,
        itemTitle: heading,
      });

      if (orderId && typeof window !== 'undefined' && window.sessionStorage) {
        try {
          window.sessionStorage.setItem(`hdyh_${orderId}`, selectedOption);
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      // silent fail
    }

    setSubmittedOption(selectedOption);
    setSubmitted(true);
    setSubmitting(false);
  };

  return (
    <s-box padding="base" border="base" borderRadius="base">
      <s-stack gap="base">
        <s-text type="strong">{heading}</s-text>

        {submitted ? (
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack gap="small">
              <s-text type="strong">✓ {successMessage}</s-text>
              {submittedOption && (
                <s-text color="subdued">
                  Your response: {submittedOption}
                </s-text>
              )}
            </s-stack>
          </s-box>
        ) : (
          <s-stack gap="base">
            <s-select
              label="Select an option"
              value={selectedOption}
              onChange={(e) => {
                const val = e?.target?.value || '';
                setSelectedOption(val);
              }}
            >
              <s-option value="">-- Select an option --</s-option>
              {options.map((option, index) => (
                <s-option key={index} value={option}>
                  {option}
                </s-option>
              ))}
            </s-select>

            <s-button
              disabled={!selectedOption || submitting}
              onClick={handleSubmit}
            >
              {submitting ? 'Submitting...' : buttonText}
            </s-button>
          </s-stack>
        )}
      </s-stack>
    </s-box>
  );
}

function signalValue(value) {
  return value?.current || value;
}
