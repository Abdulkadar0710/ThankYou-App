/* global globalThis */
import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useState} from 'preact/hooks';
import {fetchActiveBlock} from '../../shared/blocks';
import {claimExtensionRender} from '../../shared/render-once';
import {trackThankYouClick} from '../../shared/analytics';
import {apiUrls} from '../../shared/app-config';

export default () => {
  try {
    if (!claimExtensionRender('survey')) return;

    render(<Extension />, document.body);
  } catch (error) {
    console.error('Customer Survey Extension failed to render:', error);
  }
};

function Extension() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedAnswers, setSubmittedAnswers] = useState([]);

  const extensionApi =
    typeof globalThis !== 'undefined' ? globalThis.shopify : shopify;
  const orderConfirmation = extensionApi?.orderConfirmation?.current;
  const orderId = signalValue(orderConfirmation?.order?.id);
  const orderNumber = signalValue(orderConfirmation?.number);

  useEffect(() => {
    // Check if customer already submitted for this order
    if (orderId && typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const saved = window.sessionStorage.getItem(`survey_${orderId}`);
        if (saved) {
          setSubmitted(true);
          try {
            setSubmittedAnswers(JSON.parse(saved));
          } catch {
            setSubmittedAnswers([]);
          }
        }
      } catch (e) {
        // Ignore sessionStorage restrictions
      }
    }

    fetchActiveBlock('survey')
      .then((block) => setConfig(block?.config || null))
      .catch((error) => {
        console.error('Error fetching survey block:', error);
        setConfig(null);
      })
      .finally(() => setLoading(false));
  }, [orderId]);

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

  const heading = config.surveyHeading?.trim() || 'Customer Feedback Survey';
  const description = config.surveyDescription?.trim() || '';
  const questions = Array.isArray(config.questions) && config.questions.length
    ? config.questions
    : [];

  if (!questions.length) return null;

  const buttonText = config.buttonText?.trim() || 'Submit Survey';
  const successMessage =
    config.successMessage?.trim() || 'Thank you for your valuable feedback!';

  const handleAnswerChange = (qId, val) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: val,
    }));
  };

  // Check required validation
  const canSubmit = questions.every((q) => {
    if (!q.required) return true;
    const ans = answers[q.id];
    return typeof ans === 'string' && ans.trim().length > 0;
  });

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;

    setSubmitting(true);

    const answersPayload = questions.map((q) => ({
      questionId: q.id,
      question: q.question,
      type: q.type,
      answer: String(answers[q.id] || '').trim(),
    }));

    const shop = shopDomain(extensionApi?.shop);
    const payload = {
      shop,
      orderId,
      orderNumber,
      answers: answersPayload,
    };

    try {
      // 1. Submit directly to /api/survey-response
      await submitSurveyResponse(payload);

      // 2. Track analytics event
      trackThankYouClick('survey_submit', {
        itemTitle: heading,
        ctaText: buttonText,
        questionCount: questions.length,
      });

      // 3. Save to sessionStorage to avoid duplicate submissions on refresh
      if (orderId && typeof window !== 'undefined' && window.sessionStorage) {
        try {
          window.sessionStorage.setItem(
            `survey_${orderId}`,
            JSON.stringify(answersPayload),
          );
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      console.warn('Survey submission warning:', e);
    }

    setSubmittedAnswers(answersPayload);
    setSubmitted(true);
    setSubmitting(false);
  };

  return (
    <s-box padding="base" border="base" borderRadius="base">
      <s-stack gap="base">
        <div>
          <s-text type="strong">{heading}</s-text>
          {description && (
            <s-text color="subdued">{description}</s-text>
          )}
        </div>

        {submitted ? (
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack gap="small">
              <s-text type="strong">✓ {successMessage}</s-text>
              {submittedAnswers.length > 0 && (
                <s-stack gap="extra-small">
                  {submittedAnswers.map((item, idx) => (
                    <s-text key={idx} color="subdued">
                      <strong>{item.question}:</strong> {item.answer || '(No response)'}
                    </s-text>
                  ))}
                </s-stack>
              )}
            </s-stack>
          </s-box>
        ) : (
          <s-stack gap="base">
            {questions.map((q, idx) => {
              const currentVal = answers[q.id] || '';
              return (
                <s-stack key={q.id || idx} gap="small-200">
                  <s-text type="strong">
                    {idx + 1}. {q.question}
                    {q.required && ' *'}
                  </s-text>

                  {q.type === 'options' ? (
                    <s-select
                      label={`Select answer for question ${idx + 1}`}
                      value={currentVal}
                      onChange={(e) => {
                        const val = e?.target?.value || '';
                        handleAnswerChange(q.id, val);
                      }}
                    >
                      <s-option value="">-- Choose an option --</s-option>
                      {(q.options || []).map((opt, optIdx) => (
                        <s-option key={optIdx} value={opt}>
                          {opt}
                        </s-option>
                      ))}
                    </s-select>
                  ) : (
                    <s-text-area
                      label={`Type answer for question ${idx + 1}`}
                      placeholder={q.placeholder || 'Type your answer here...'}
                      value={currentVal}
                      onInput={(e) => {
                        const val = e?.target?.value || '';
                        handleAnswerChange(q.id, val);
                      }}
                      rows={3}
                    />
                  )}
                </s-stack>
              );
            })}

            <s-button
              disabled={!canSubmit || submitting}
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

async function submitSurveyResponse(payload) {
  for (const url of apiUrls('/api/survey-response')) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => null);
      if (response.ok && data?.success) {
        return data;
      }
    } catch (err) {
      // try next url
    }
  }
}

function shopDomain(shop) {
  const domain =
    shop?.myshopifyDomain ||
    shop?.domain ||
    shop?.storefrontUrl?.current ||
    shop?.storefrontUrl ||
    '';

  return String(domain)
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .trim()
    .toLowerCase();
}

function signalValue(value) {
  if (value && typeof value === 'object' && 'value' in value) {
    return value.value;
  }
  return value;
}
