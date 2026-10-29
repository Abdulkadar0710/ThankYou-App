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
  const [currentStep, setCurrentStep] = useState(0);
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

  const heading = config.surveyHeading?.trim() || 'Purchase Satisfaction';
  const description = config.surveyDescription?.trim() || '';
  const rawQuestions = Array.isArray(config.questions) && config.questions.length
    ? config.questions
    : [];

  // Filter valid questions
  const questions = rawQuestions.filter(
    (q) => q && typeof q === 'object' && typeof q.question === 'string' && q.question.trim().length > 0
  );

  if (!questions.length) return null;

  const totalSteps = questions.length;
  const activeIndex = Math.min(Math.max(0, currentStep), totalSteps - 1);
  const currentQ = questions[activeIndex];
  const currentAns = answers[currentQ?.id] || '';

  const buttonText = config.buttonText?.trim() || 'Submit';
  const successMessage =
    config.successMessage?.trim() || 'Your message has been recorded successfully.';

  const handleAnswerChange = (qId, val) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: val,
    }));
  };

  const isCurrentStepValid = () => {
    if (!currentQ?.required) return true;
    return typeof currentAns === 'string' && currentAns.trim().length > 0;
  };

  const handleNext = () => {
    if (!isCurrentStepValid()) return;
    if (activeIndex < totalSteps - 1) {
      setCurrentStep(activeIndex + 1);
    }
  };

  const handlePrev = () => {
    if (activeIndex > 0) {
      setCurrentStep(activeIndex - 1);
    }
  };

  const handleSubmit = async () => {
    if (!isCurrentStepValid() || submitting) return;

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

  const progressPercent = Math.round(((activeIndex + 1) / totalSteps) * 100);

  return (
    <s-box padding="base" border="base" borderRadius="base">
      <s-stack gap="base">
        {submitted ? (
          <s-box padding="base" background="subdued" borderRadius="base">
            <s-stack gap="small">
              <s-text type="strong">✓ {successMessage}</s-text>
            </s-stack>
          </s-box>
        ) : (
          <s-stack gap="base">
            {/* Header with Title and Step Progress */}
            <s-stack gap="small-200">
              <s-text type="strong">{heading}</s-text>
              {description && <s-text color="subdued">{description}</s-text>}
              {totalSteps > 1 && (
                <s-stack gap="small-100">
                  <s-text color="subdued">
                    Question {activeIndex + 1} of {totalSteps}
                  </s-text>
                  <s-progress value={progressPercent} max={100} />
                </s-stack>
              )}
            </s-stack>

            {/* Current Question */}
            <s-stack gap="small">
              <s-text type="strong">
                {currentQ.question}
                {currentQ.required ? ' *' : ''}
              </s-text>

              {currentQ.type === 'options' ? (
                <s-choice-list
                  name={`survey_choice_${currentQ.id}`}
                  variant="block"
                  values={currentAns ? [currentAns] : []}
                  onChange={(e) => {
                    const selected =
                      e?.target?.values?.[0] || e?.target?.value || '';
                    handleAnswerChange(currentQ.id, selected);
                  }}
                >
                  {(currentQ.options || []).map((opt, optIdx) => (
                    <s-choice key={optIdx} value={opt}>
                      {opt}
                    </s-choice>
                  ))}
                </s-choice-list>
              ) : (
                <s-text-area
                  label="Your response"
                  placeholder={currentQ.placeholder || 'Type your answer here...'}
                  value={currentAns}
                  onInput={(e) => {
                    const val = e?.target?.value || '';
                    handleAnswerChange(currentQ.id, val);
                  }}
                  rows={3}
                />
              )}
            </s-stack>

            {/* Navigation & Action Buttons */}
            <s-grid
              gridTemplateColumns={activeIndex > 0 ? 'auto 1fr auto' : '1fr auto'}
              gap="small"
            >
              {activeIndex > 0 ? (
                <s-button
                  variant="secondary"
                  disabled={submitting}
                  onClick={handlePrev}
                >
                  Previous
                </s-button>
              ) : null}

              {/* Spacer */}
              <s-box />

              {activeIndex < totalSteps - 1 ? (
                <s-button
                  variant="primary"
                  disabled={!isCurrentStepValid()}
                  onClick={handleNext}
                >
                  Next
                </s-button>
              ) : (
                <s-button
                  variant="primary"
                  disabled={!isCurrentStepValid() || submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? 'Submitting...' : buttonText}
                </s-button>
              )}
            </s-grid>
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
