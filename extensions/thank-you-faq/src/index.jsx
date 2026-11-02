import '@shopify/ui-extensions/preact';
import {render} from "preact";
import {useEffect, useRef, useState} from "preact/hooks";
import {trackThankYouClick} from '../../shared/analytics';
import {hasText, limitText} from '../../shared/text';
import {fetchActiveBlock} from '../../shared/blocks';
import {claimExtensionRender} from '../../shared/render-once';

export default () => {
  try {
    if (!claimExtensionRender('faq')) return;

    render(<Extension />, document.body);
  } catch (error) {
    console.error('Extension failed to render:', error);
    // Graceful fallback - render nothing rather than breaking page
  }
};

function Extension() {
  const [faqs, setFaqs] = useState([]);
  const [heading, setHeading] = useState('');
  const [openIndex, setOpenIndex] = useState(null);
  const [loading, setLoading] = useState(true);
  const openedFaqsRef = useRef(new Set());

  useEffect(() => {
    fetchActiveBlock('faq')
      .then((block) => {
        const items = block?.config?.items || [];

        setHeading(block?.config?.heading || '');
        setFaqs(
          items
            .map((item) => ({
              q: item.question,
              a: item.answer,
            }))
            .filter((faq) => hasText(faq.q) && hasText(faq.a)),
        );
      })
      .catch((error) => {
        console.error(error);
        setHeading('');
        setFaqs([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleFAQ = (index) => {
    const faq = faqs[index];
    const isOpen = openIndex === index;

    if (!isOpen) {
      trackThankYouClick(
        'faq_click',
        {ctaText: faq.q, itemTitle: faq.q},
      );
    }

    setOpenIndex(isOpen ? null : index);
  };

  if (loading) {
    return (
      <s-stack gap="base">
        <s-box padding="base" border="base" borderRadius="base">
          <s-stack gap="base">
            <s-skeleton-paragraph />
            <s-skeleton-paragraph />
          </s-stack>
        </s-box>
      </s-stack>
    );
  }
  
  if (!faqs.length) return null;

  return (
    <s-box padding="base" border="base" borderRadius="base">
      <s-stack gap="none">

    {heading && (
      <s-box padding="small" background="subdued" borderRadius="base">
          <s-text type="strong">{heading}</s-text>
      </s-box>
    )}

    {faqs.map((faq, i) => (
      <s-box
        key={i}
        paddingBlock="base"
      >
        <s-details
          onToggle={(e) => {
            if (e.target.open && !openedFaqsRef.current.has(faq.q)) {
              openedFaqsRef.current.add(faq.q);
              trackThankYouClick("faq_click", {
                ctaText: faq.q,
                itemTitle: faq.q,
              });
            }
          }}
        >
          <s-summary>
            <s-text type="strong">{limitText(faq.q, 72)}</s-text>
          </s-summary>

          <s-box paddingBlockStart="base">
            <s-text>{faq.a}</s-text>
          </s-box>
        </s-details>
      </s-box>
    ))}

  </s-stack>
    </s-box>
  );
}
