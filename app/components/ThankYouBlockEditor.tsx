import type {
  CheckoutUpsellProduct,
  ProductCondition,
  ProductConditionValue,
  ThankYouBlockConfig,
  ThankYouBlockType,
  CheckoutUpsellSource
} from "../models/thankYouBlock";
import {useAppBridge} from "@shopify/app-bridge-react";
import {blockTemplates, validateBlockForm} from "../models/thankYouBlock";
import {
  useState,
  useRef,
  useEffect,
  type CSSProperties,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {Form, useNavigate} from "react-router";
import RichTextField from "./RichTextField";
import {useEditor, EditorContent} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";

type Props = {
  blockId?: string;
  type: ThankYouBlockType;
  name: string;
  status: string;
  config: ThankYouBlockConfig;
  mode: "create" | "edit";
};

type SaveResult = {
  success?: boolean;
  message?: string;
  errors?: string[];
  redirectTo?: string;
};

const fieldStyle: CSSProperties = {
  border: "1px solid #c9cccf",
  borderRadius: "8px",
  font: "inherit",
  padding: "10px 12px",
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
  display: "block",
};

const labelStyle: CSSProperties = {
  display: "block",
  fontWeight: 650,
  marginBlockEnd: "6px",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gap: "16px",
  gridTemplateColumns: "minmax(0, 2fr) minmax(240px, 1fr)",
  alignItems: "start",
  width: "100%",
};

const cardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #d7dce0",
  borderRadius: "10px",
  padding: "16px",
  overflow: "hidden",
  width: "100%",
  boxSizing: "border-box",
};

const submitStyle: CSSProperties = {
  background: "#303030",
  border: 0,
  borderRadius: "8px",
  color: "#fff",
  cursor: "pointer",
  font: "inherit",
  fontWeight: 650,
  padding: "10px 14px",
};

const secondaryButtonStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #c9cccf",
  borderRadius: "8px",
  color: "#303030",
  cursor: "pointer",
  font: "inherit",
  fontWeight: 650,
  padding: "10px 14px",
};

export function ThankYouBlockEditor({
  blockId,
  type,
  name,
  status,
  config,
  mode,
}: Props) {
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const template = blockTemplates[type];
  const faqItems = config.items?.length
    ? config.items
    : defaultFaqItems(template.defaultConfig);

//     const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
//   event.preventDefault();
//   const form = event.currentTarget;

//   setSaveError("");

//   const formData = new FormData(form);

//   const heading = (formData.get("heading") as string)?.trim();
//   const mediaType = formData.get("mediaType") as string;
//   const imageUrl = (formData.get("imageUrl") as string)?.trim();
//   const videoUrl = (formData.get("videoUrl") as string)?.trim();
//   const videoThumbnail = (
//     formData.get("videoThumbnail") as string
//   )?.trim();

//   // Validate Image Block
//   if ((type === "image" || mediaType === "image")) {
//     if (!heading) {
//       setSaveError("Section header is required.");
//       return;
//     }

//     if (!imageUrl) {
//       setSaveError("Image URL is required.");
//       return;
//     }
//   }

//   // Validate Video Block
//   if ((type === "video" || mediaType === "video")) {
//     if (!heading) {
//       setSaveError("Video title is required.");
//       return;
//     }

//     if (!videoUrl) {
//       setSaveError("Video URL is required.");
//       return;
//     }

//     if (!videoThumbnail) {
//       setSaveError("Thumbnail image URL is required.");
//       return;
//     }
//   }

//   setIsSaving(true);

//   try {
//     const token = await shopify.idToken();

//     const response = await fetch(
//       window.location.pathname + window.location.search,
//       {
//         method: "POST",
//         headers: {
//           Accept: "application/json",
//           Authorization: `Bearer ${token}`,
//         },
//         body: formData,
//       }
//     );

//     const result = (await response.json().catch(() => null)) as
//       | SaveResult
//       | null;

//     if (response.status === 401) {
//       setSaveError(result?.message || "Not authenticated. Please log in.");
//       return;
//     }

//     if (!response.ok || !result?.success) {
//       setSaveError(result?.message || "Could not save block.");
//       return;
//     }

//     navigate(result?.redirectTo || "/app/blocks");
//   } catch (error) {
//     console.error("SAVE REQUEST ERROR:", error);
//     setSaveError(
//       error instanceof Error ? error.message : "Could not save block."
//     );
//   } finally {
//     setIsSaving(false);
//   }
// };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const validation = validateBlockForm(type, formData);

    setSaveError("");

    if (!validation.success) {
      setSaveError(validation.errors.join(" "));
      return;
    }

    setIsSaving(true);

    try {
      const token = await shopify.idToken();
      const response = await fetch(window.location.pathname + window.location.search, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const result = (await response.json().catch(() => null)) as SaveResult | null;

      // Surface explicit authentication errors to the user without throwing generic message
      if (response.status === 401) {
        setSaveError(result?.message || "Not authenticated. Please log in.");
        return;
      }

      // if (!response.ok || !result?.success) {
      //   setSaveError(
      //     result?.errors?.join(" ") || result?.message || "Could not save block.",
      //   );
      //   return;
      // }

      navigate(result?.redirectTo || "/app/blocks");
    } catch (error) {
      console.error("SAVE REQUEST ERROR:", error);
      setSaveError(
        error instanceof Error ? error.message : "Could not save block2.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
      <s-page
          heading={
            mode === "create"
              ? template.title
              : name.length > 50
              ? `${name.slice(0, 50)}...`
              : name
          }
        >
      <s-button slot="breadcrumb-actions" href="/app/blocks">
        Blocks
      </s-button>

      <Form method="post" onSubmit={handleSubmit}>
        <input type="hidden" name="type" value={type} />

        <div style={gridStyle}>
          <s-stack gap="base">
            <section style={cardStyle}>
              <s-stack gap="small">
                <s-heading>Block name</s-heading>
                <input
                  aria-label="Block name"
                  defaultValue={name}
                  maxLength={69}
                  name="name"
                  required
                  style={fieldStyle}
                />
                <s-text color="subdued">
                  Internal only. Not shown to customers.
                </s-text>
              </s-stack>
            </section>

            <section style={cardStyle}>
              <s-stack gap="base">
                {/* <s-heading>Content</s-heading> */}
                {type === "faq" ? (
                  <FaqFields heading={config.heading} items={faqItems} />
                ) : type === "image" || type === "video" || type === "media" ? (
                  <MediaFields config={config} type={type} />
                ) : type === "discount" ? (
                  <DiscountFields config={config} />
                ) : type === "subscription" ? (
                  <SubscriptionFields config={config} />
                ) : type === "referral" ? (
                  <ReferralFields config={config} />
                ) : type === "loyalty" ? (
                  <LoyaltyFields config={config} />
                ) : type === "checkoutUpsell" ? (
                  <CheckoutUpsellFields config={config} />
                ) : type === "freeShippingProgress" ? (
                  <FreeShippingProgressFields config={config} />
                ) : type === "giftOptions" ? (
                  <GiftOptionsFields config={config} />
                ) : type === "howDidYouHear" ? (
                  <HowDidYouHearFields config={config} />
                ) : (
                  <UpsellFields config={config} />
                )}
              </s-stack>
            </section>

            {/* <section style={cardStyle}>
              <s-stack gap="small">
                <s-heading>Display rules</s-heading>
                <s-box padding="base" borderWidth="base" borderRadius="base">
                  <s-text>Block will be shown to all customers.</s-text>
                </s-box>
              </s-stack>
            </section>*/}

            <section style={{ display: "none" }}>
              <s-stack gap="small">
                <s-heading>Block ID</s-heading>
                <input
                  aria-label="Block ID"
                  disabled
                  style={fieldStyle}
                  value={blockId || "Create after save"}
                />
                <s-text color="subdued">
                  Use the matching app extension block in Shopify checkout
                  customization.
                </s-text>
              </s-stack>
            </section> 
          </s-stack>

          <s-stack gap="base">
            {/* <section style={cardStyle}>
              <s-stack gap="small">
                <s-heading>Preview</s-heading>
                <BlockPreview type={type} config={config} />
              </s-stack>
            </section> */}

            <section style={cardStyle}>
              <s-stack gap="small">
                <s-heading>Status</s-heading>
                <select
                  aria-label="Status"
                  defaultValue={status}
                  name="status"
                  style={fieldStyle}
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                </select>
              </s-stack>
            </section>

            {/* <section style={cardStyle}>
              <s-stack gap="small">
                <s-heading>Publishing</s-heading>
                <s-text>Locations</s-text>
                <s-unordered-list>
                  <s-list-item>Thank you</s-list-item>
                  <s-list-item>Order status</s-list-item>
                </s-unordered-list>
              </s-stack>
            </section> */}

            {saveError && (
              <s-banner tone="critical">
                <s-text>{saveError}</s-text>
              </s-banner>
            )}

            <button disabled={isSaving} type="submit" style={submitStyle}>
              {isSaving ? "Saving..." : "Save"}
            </button>
          </s-stack>
        </div>
      </Form>
    </s-page>
  );
}

// function FaqFields({items}: {items: Array<{question: string; answer: string}>}) {
//   return (
//     <s-stack gap="base">
//       <div>
//         <label style={labelStyle} htmlFor="heading">
//           Section header
//         </label>
//         <input
//           defaultValue="Frequently asked questions"
//           id="heading"
//           maxLength={80}
//           name="heading"
//           style={fieldStyle}
//         />
//       </div>

//       {Array.from({length: 5}, (_, index) => {
//         const item = items[index] || {question: "", answer: ""};
//         const position = index + 1;

//         return (
//           <s-box
//             key={position}
//             padding="base"
//             borderWidth="base"
//             borderRadius="base"
//           >
//             <s-stack gap="small">
//               <s-heading>Accordion item {position}</s-heading>
//               <input
//                 aria-label={`Question ${position}`}
//                 defaultValue={item.question}
//                 maxLength={80}
//                 name={`question_${position}`}
//                 placeholder="Question"
//                 style={fieldStyle}
//               />
//               <textarea
//                 aria-label={`Answer ${position}`}
//                 defaultValue={item.answer}
//                 maxLength={240}
//                 name={`answer_${position}`}
//                 placeholder="Answer"
//                 rows={3}
//                 style={fieldStyle}
//               />
//             </s-stack>
//           </s-box>
//         );
//       })}
//     </s-stack>
//   );
// }



function FaqFields({
  heading,
  items,
}: {
  heading?: string;
  items: Array<{question: string; answer: string}>;
}) {
  const [faqs, setFaqs] = useState(
    items.length ? items : [{question: "", answer: ""}],
  );
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  // Update hidden input whenever faqs changes
  useEffect(() => {
    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = JSON.stringify(faqs);
    }
  }, [faqs]);

  const addFaq = () => {
    setFaqs([...faqs, {question: "", answer: ""}]);
  };

  const removeFaq = (index: number) => {
    setFaqs(faqs.filter((_, i) => i !== index));
  };

  const updateFaq = (
    index: number,
    field: "question" | "answer",
    value: string,
  ) => {
    const updated = [...faqs];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setFaqs(updated);
  };
 

  return (
    <s-stack gap="base">
      <div>
        <label style={labelStyle} htmlFor="heading">
          Section header
        </label>
        <input
          defaultValue={heading || "Frequently asked questions"}
          id="heading"
          maxLength={80}
          name="heading"
          required
          style={fieldStyle}
        />
      </div>

      {faqs.map((item, index) => (
        <s-box
          key={index}
          padding="base"
          borderWidth="base"
          borderRadius="base"
        >
          <s-stack gap="small">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              {/* <s-heading>FAQ {index + 1}</s-heading> */}
              <div
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  minWidth: 0,
                }}
              >
                <s-heading>FAQ {index + 1}</s-heading>
              </div>

              {faqs.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeFaq(index)}
                  style={{
                    border: "none",
                    background: "none",
                    color: "#d82c0d",
                    cursor: "pointer",
                  }}
                >
                  Remove FAQ
                </button>
              )}
            </div>

            <label style={labelStyle} htmlFor={`question_${index}`}>
              Question
            </label>
            <input
              id={`question_${index}`}
              maxLength={80}
              value={item.question}
              onInput={(e) =>
                updateFaq(
                  index,
                  "question",
                  (e.target as HTMLInputElement).value,
                )
              }
              name={`question_${index}`}
              placeholder="Question"
              required
              style={fieldStyle}
            />

            <label style={labelStyle} htmlFor={`answer_${index}`}>
              Answer
            </label>
            <textarea
              id={`answer_${index}`}
              value={item.answer}
              onInput={(e) =>
                updateFaq(
                  index,
                  "answer",
                  (e.target as HTMLTextAreaElement).value,
                )
              }
              name={`answer_${index}`}
              placeholder="Answer"
              required
              rows={4}
              style={fieldStyle}
            />

            
            
          </s-stack>
        </s-box>
      ))}

      {/* Hidden field for form submission */}
      <input
        ref={hiddenInputRef}
        type="hidden"
        name="faq_data"
        readOnly
        value={JSON.stringify(faqs)}
      />
      

      <div style={{display: "flex", justifyContent: "flex-end"}}>
        <button
          type="button"
          onClick={addFaq}
          style={{
            padding: "8px 16px",
            cursor: "pointer",
          }}
        >
          + Add FAQ
        </button>
      </div>
    </s-stack>
  );
}

function defaultFaqItems(config: unknown) {
  if (!config || typeof config !== "object" || !("items" in config)) {
    return [];
  }

  const items = (config as {items?: unknown}).items;

  return Array.isArray(items)
    ? items.map((item) => ({
        question:
          item && typeof item === "object" && "question" in item
            ? String(item.question)
            : "",
        answer:
          item && typeof item === "object" && "answer" in item
            ? String(item.answer)
            : "",
      }))
    : [];
}

function MediaFields({
  config,
  type,
}: {
  config: ThankYouBlockConfig;
  type: ThankYouBlockType;
}) {
  const fixedMediaType =
    type === "image" || type === "video" ? type : undefined;
  const initialMediaType =
    fixedMediaType || config.mediaType || (config.videoUrl ? "video" : "image");
  const [mediaType, setMediaType] = useState(initialMediaType);
  const isVideo = fixedMediaType === "video" || mediaType === "video";

  return (
    <s-stack gap="base">
      <div>
        <label style={labelStyle} htmlFor="heading">
          {isVideo ? "Video title" : "Section header"}
        </label>
        <input
          defaultValue={config.heading || (isVideo ? "Watch this" : "")}
          id="heading"
          maxLength={60}
          name="heading"
          style={fieldStyle}
        />
      </div>

      {fixedMediaType ? (
        <input type="hidden" name="mediaType" value={fixedMediaType} />
      ) : (
        <div>
          <label style={labelStyle} htmlFor="mediaType">
            Media type
          </label>
          <select
            value={mediaType}
            id="mediaType"
            name="mediaType"
            onChange={(event) =>
              setMediaType(
                (event.target as HTMLSelectElement).value as "image" | "video",
              )
            }
            style={fieldStyle}
          >
            <option value="image">Image</option>
            <option value="video">Video</option>
          </select>
        </div>
      )}

      {isVideo ? (
        <>
          <input
            aria-label="Video URL"
            defaultValue={config.videoUrl || ""}
            name="videoUrl"
            placeholder="Video URL"
            type="url"
            style={fieldStyle}
            required
          />
          <text>Enter a valid video URL (YouTube, Vimeo, MP4, or other supported video link). The video will open in a new browser tab when customers click the link.</text>
          <ImageSourceField
            label="Thumbnail Image (URL or Upload)"
            name="videoThumbnail"
            value={config.videoThumbnail || ""}
            placeholder="Thumbnail Image (URL or Upload)"
          />
        </>
      ) : (
        <>
        
          <ImageSourceField
            label="Image (URL or Upload)"
            name="imageUrl"
            value={config.imageUrl || ""}
            placeholder="Image (URL or Upload)"
          />
           <input
            aria-label="Image alt text"
            defaultValue={config.imageAlt || ""}
            name="imageAlt"
            placeholder="Image alt text (optional)"
            style={fieldStyle}
          />
          <input
            aria-label="Image link"
            defaultValue={config.imageLink || ""}
            name="imageLink"
            placeholder="Image link (optional)"
            type="url"
            style={fieldStyle}
          />
        </>
      )}
    </s-stack>
  );
}

function ImageSourceField({
  label,
  name,
  value,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  placeholder: string;
}) {
  const [source, setSource] = useState(value);
  const [error, setError] = useState("");

  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    setError("");

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }

    if (file.size > 1000 * 1024) {
      setError(
        "Uploaded image must be smaller than 1000 KB. Use a Shopify Files URL for larger images.",
      );
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        setSource(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <label style={labelStyle} htmlFor={name}>
        {label}
      </label>
      <text>Upload an image here or provide a publicly accessible image URL or upload an image to Shopify Files (Content → Files) and use its URL here.</text>
         
      <input
        id={name}
        name={name}
        onChange={(event) => setSource(event.target.value)}
        placeholder={placeholder}
        required
        style={fieldStyle}
        type={source.startsWith("data:image/") ? "text" : "url"}
        value={source}
      />
      <div style={{marginBlockStart: "8px"}}>
        <input
          accept="image/*"
          aria-label={`Upload ${label.toLowerCase()}`}
          onChange={handleUpload}
          type="file"
        />
      </div>
      {error && (
        <s-banner tone="critical">
          {error}
        </s-banner>
      )}
    </div>
  );
}

function DiscountFields({config}: {config: ThankYouBlockConfig}) {
  return (
    <s-stack gap="base">
      <TextField
        label="Title"
        name="title"
        value={config.title || "Discount code"}
        maxLength={80}
        required
      />
      <TextAreaField
        label="Description"
        name="description"
        value={config.description || "Use this code on your next purchase:"}
        required
      />
      <TextField
        label="Discount code"
        name="discountCode"
        value={config.discountCode || ""}
        maxLength={40}
        required
      />
    </s-stack>
  );
}

function HowDidYouHearFields({config}: {config: ThankYouBlockConfig}) {
  return (
    <s-stack gap="base">
      <TextField
        label="Heading"
        name="heading"
        value={config.heading || "How did you hear about us?"}
        maxLength={100}
        required
      />
    </s-stack>
  );
}

function SubscriptionFields({config}: {config: ThankYouBlockConfig}) {
  return (
    <s-stack gap="base">
      <TextField
        label="Heading"
        name="subscriptionHeading"
        value={config.subscriptionHeading || "Never run out again"}
        maxLength={80}
        required
      />
      <TextAreaField
        label="Description"
        name="subscriptionBody"
        value={
          config.subscriptionBody ||
          "Subscribe and get exclusive savings on every order."
        }
        required
      />
      <TextField
        label="Email placeholder"
        name="emailPlaceholder"
        value={config.emailPlaceholder || "Email address"}
        maxLength={60}
        required
      />
      <TextField
        label="Button text"
        name="buttonText"
        value={config.buttonText || "Subscribe"}
        maxLength={24}
        required
      />
      <TextField
        label="Success message"
        name="successMessage"
        value={config.successMessage || "Thanks for subscribing."}
        maxLength={100}
        required
      />
    </s-stack>
  );
}

function ReferralFields({config}: {config: ThankYouBlockConfig}) {
  return (
    <s-stack gap="base">
      {/* <s-box padding="base" borderWidth="base" borderRadius="base">
        <s-text>
          You can use variables in the description: {"{friend_reward}"},{" "}
          {"{advocate_reward}"}, {"{referral_code}"}, and {"{referral_link}"}.
        </s-text>
      </s-box> */}

      <TextField
        label="Title"
        name="title"
        value={config.title || "Refer friends. Get rewards."}
        maxLength={80}
        required
      />
      <RichTextField
        label="Description"
        name="description"
        required
        value={
          config.description ||
          "Give your friends {friend_reward} off all products. Get {advocate_reward} off all products when they purchase with your discount code {referral_code}."
        }
      />
      <s-text>
          You can use variables in the description: {"{friend_reward}"},{" "}
          {"{advocate_reward}"}, {"{referral_code}"}, and {"{referral_link}"}.
        </s-text>
      <TextField
        label="Share now text"
        name="shareLabel"
        value={config.shareLabel || "Share now:"}
        maxLength={40}
        required
      />
      {/* <TextField
        label="Share button text"
        name="shareText"
        value={config.shareText || "Share"}
        maxLength={24}
      /> */}
      <TextField
        label="Friend reward"
        name="friendReward"
        value={config.friendReward || "15%"}
        maxLength={30}
        required
      />
      <TextField
        label="Advocate reward"
        name="advocateReward"
        value={config.advocateReward || "$10"}
        maxLength={30}
        required
      />
      <TextField
        label="Referral code"
        name="referralCode"
        value={config.referralCode || "THANKYOU15"}
        maxLength={40}
        required
      />
      {/* <TextField
        label="Referral link"
        name="referralLink"
        value={config.referralLink || ""}
        placeholder="https://example.com/referral"
      /> */}
    </s-stack>
  );
}

function LoyaltyFields({config}: {config: ThankYouBlockConfig}) {
  return (
    <s-stack gap="base">
      <TextField
        label="Title"
        name="title"
        value={config.title || "Join our loyalty program"}
        maxLength={80}
        required
      />
      <RichTextField
        label="Description"
        name="description"
        value={
          config.description ||
          "Earn 2x points on future purchases and unlock member-only rewards."
        }
        required
      />
      <TextField
        label="Points badge"
        name="pointsText"
        value={config.pointsText || "2x points"}
        maxLength={40}
        required
      />
      <TextField
        label="Button text"
        name="buttonText"
        value={config.buttonText || "Join now"}
        maxLength={24}
        required
      />
      <TextField
        label="Button link"
        name="buttonUrl"
        value={config.buttonUrl || ""}
        placeholder="https://example.com/account/register"
        required
        type="url"
      />
      <TextField
        label="Valid until"
        name="validUntil"
        value={config.validUntil || ""}
        type="date"
      />
    </s-stack>
  );
}

function FreeShippingProgressFields({config}: {config: ThankYouBlockConfig}) {
  return (
    <s-stack gap="base">
      <TextField
        label="Heading"
        name="freeShippingHeading"
        value={config.freeShippingHeading || "Free shipping"}
        maxLength={80}
        required
      />
      <TextField
        label="Remaining amount message"
        name="freeShippingRemainingMessage"
        value={
          config.freeShippingRemainingMessage ||
          "You're {amount} away from free shipping."
        }
        maxLength={120}
        required
      />
      <TextField
        label="Success message"
        name="freeShippingSuccessMessage"
        value={
          config.freeShippingSuccessMessage ||
          "You've unlocked free shipping."
        }
        maxLength={120}
        required
      />
      <s-box padding="base" borderWidth="base" borderRadius="base">
        <s-text>
          Use {"{amount}"} in the remaining message to show the live amount
          left before the checkout shipping amount.
        </s-text>
      </s-box>
    </s-stack>
  );
}

function GiftOptionsFields({config}: {config: ThankYouBlockConfig}) {
  return (
    <s-stack gap="base">
      <TextField
        label="Heading"
        name="giftOptionsHeading"
        value={config.giftOptionsHeading || "Gift options"}
        maxLength={80}
        required
      />

      <CheckboxField
        label="Enable gift wrap"
        name="giftWrapEnabled"
        checked={config.giftWrapEnabled !== false}
      />
      <TextField
        label="Gift wrap label"
        name="giftWrapLabel"
        value={config.giftWrapLabel || "Add gift wrap"}
        maxLength={80}
      />

      <CheckboxField
        label="Enable gift message"
        name="giftMessageEnabled"
        checked={config.giftMessageEnabled !== false}
      />
      <TextField
        label="Gift message label"
        name="giftMessageLabel"
        value={config.giftMessageLabel || "Gift message"}
        maxLength={80}
      />
      <TextField
        label="Gift message placeholder"
        name="giftMessagePlaceholder"
        value={
          config.giftMessagePlaceholder ||
          "Write a message for the recipient"
        }
        maxLength={120}
      />
      <s-box padding="base" borderWidth="base" borderRadius="base">
        <s-text>
          Customer selections are saved as checkout attributes and appear on
          the order details in Shopify.
        </s-text>
      </s-box>
    </s-stack>
  );
}

function TextField({
  label,
  name,
  value,
  maxLength,
  placeholder,
  required,
  type = "text",
}: {
  label: string;
  name: string;
  value: string;
  maxLength?: number;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label style={labelStyle} htmlFor={name}>
        {label}
      </label>
      <input
        defaultValue={value}
        id={name}
        maxLength={maxLength}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "0.01" : undefined}
        name={name}
        placeholder={placeholder}
        required={required}
        style={fieldStyle}
        type={type}
      />
    </div>
  );
}

function CheckboxField({
  label,
  name,
  checked,
}: {
  label: string;
  name: string;
  checked: boolean;
}) {
  return (
    <label
      style={{
        alignItems: "center",
        display: "flex",
        gap: "10px",
        fontWeight: 650,
      }}
    >
      <input defaultChecked={checked} name={name} type="checkbox" />
      {label}
    </label>
  );
}

const richTextToolbarStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
  marginBlockEnd: "8px",
};

const richTextButtonStyle: CSSProperties = {
  border: "1px solid #c9cccf",
  borderRadius: "6px",
  background: "#fff",
  cursor: "pointer",
  font: "inherit",
  padding: "6px 10px",
};

// function RichTextField({
//   label,
//   name,
//   value,
//   required,
// }: {
//   label: string;
//   name: string;
//   value: string;
//   required?: boolean;
// }) {
//   const editorRef = useRef<HTMLDivElement>(null);
//   const [html, setHtml] = useState(value);

//   const syncValue = () => {
//     const nextHtml = editorRef.current?.innerHTML || "";
//     const normalized = nextHtml === "<br>" ? "" : nextHtml;

//     setHtml(normalized);
//   };

//   const runCommand = (command: string, commandValue?: string) => {
//     editorRef.current?.focus();
//     document.execCommand(command, false, commandValue);
//     syncValue();
//   };

//   const addLink = () => {
//     const url = window.prompt("Enter link URL");

//     if (!url) return;

//     try {
//       const parsed = new URL(url);

//       if (parsed.protocol === "http:" || parsed.protocol === "https:") {
//         runCommand("createLink", parsed.toString());
//       }
//     } catch {
//       return;
//     }
//   };

//   return (
//     <div>
//       <label style={labelStyle} htmlFor={`${name}_editor`}>
//         {label}
//       </label>
//       <div style={richTextToolbarStyle}>
//         <button
//           onClick={() => runCommand("bold")}
//           style={richTextButtonStyle}
//           type="button"
//         >
//           B
//         </button>
//         <button
//           onClick={() => runCommand("italic")}
//           style={richTextButtonStyle}
//           type="button"
//         >
//           I
//         </button>
//         <button
//           onClick={() => runCommand("insertUnorderedList")}
//           style={richTextButtonStyle}
//           type="button"
//         >
//           List
//         </button>
//         <button
//           onClick={addLink}
//           style={richTextButtonStyle}
//           type="button"
//         >
//           Link
//         </button>
//       </div>
//       <div
//         contentEditable
//         dangerouslySetInnerHTML={{__html: value}}
//         id={`${name}_editor`}
//         onBlur={syncValue}
//         onInput={syncValue}
//         ref={editorRef}
//         role="textbox"
//         style={{...fieldStyle, minHeight: "120px"}}
//         suppressContentEditableWarning
//       />
//       <input name={name} required={required} type="hidden" value={html} />
//     </div>
//   );
// }

function TextAreaField({
  label,
  name,
  value,
  required,
}: {
  label: string;
  name: string;
  value: string;
  required?: boolean;
}) {
  return (
    <div>
      <label style={labelStyle} htmlFor={name}>
        {label}
      </label>
      <textarea
        defaultValue={value}
        id={name}
        name={name}
        required={required}
        rows={5}
        style={fieldStyle}
      />
    </div>
  );
}

// The preview panel is currently hidden, but this stays ready for re-enabling.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function BlockPreview({
  type,
  config,
}: {
  type: ThankYouBlockType;
  config: ThankYouBlockConfig;
}) {
  if (type === "referral") {
    const code = config.referralCode || "THANKYOU15";

    return (
      <s-box padding="base" borderWidth="base" borderRadius="base">
        <s-stack gap="small">
          <s-box padding="small" background="subdued" borderRadius="base">
            <s-text type="strong">{config.title || "Refer friends. Get rewards."}</s-text>
          </s-box>
          <s-text>
            {replaceReferralVariables(
              config.description ||
                "Give your friends {friend_reward} off all products. Get {advocate_reward} off all products when they purchase with your discount code {referral_code}.",
              config,
            )}
          </s-text>
          <s-text color="subdued">{config.shareLabel || "Share now:"}</s-text>
          <s-stack direction="inline" gap="small">
            <s-button>{config.shareText || "Share"}</s-button>
            <s-button variant="secondary">{code}</s-button>
          </s-stack>
        </s-stack>
      </s-box>
    );
  }

  if (type === "loyalty") {
    return (
      <s-box padding="base" borderWidth="base" borderRadius="base">
        <s-stack gap="small">
          <s-box padding="small" background="subdued" borderRadius="base">
            <s-text type="strong">{config.pointsText || "2x points"}</s-text>
          </s-box>
          <s-text type="strong">{config.title || "Join our loyalty program"}</s-text>
          <s-text>
            {config.description ||
              "Earn 2x points on future purchases and unlock member-only rewards."}
          </s-text>
          <s-button>{config.buttonText || "Join now"}</s-button>
          {config.validUntil && <s-text color="subdued">{config.validUntil}</s-text>}
        </s-stack>
      </s-box>
    );
  }

  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      <s-text color="subdued">Save to preview this block on the thank-you page.</s-text>
    </s-box>
  );
}

function replaceReferralVariables(
  value: string,
  config: ThankYouBlockConfig,
) {
  return value
    .replaceAll("{friend_reward}", config.friendReward || "15%")
    .replaceAll("{advocate_reward}", config.advocateReward || "$10")
    .replaceAll("{referral_code}", config.referralCode || "THANKYOU15")
    .replaceAll("{referral_link}", config.referralLink || "");
}

function UpsellFields({config}: {config: ThankYouBlockConfig}) {
  return (
    <s-stack gap="base">
      <div>
        <label style={labelStyle} htmlFor="upsellHeading">
          Section header
        </label>
        <input
          defaultValue={config.upsellHeading || "Recommended products"}
          id="upsellHeading"
          width={70}
          name="upsellHeading"
          style={fieldStyle}
          required
        />
      </div>
      <div>
        <label style={labelStyle} htmlFor="emptyMessage">
          Empty message
        </label>
        <input
          defaultValue={config.emptyMessage || "No recommendations found"}
          id="emptyMessage"
          maxLength={80}
          name="emptyMessage"
          style={fieldStyle}
          required
        />
      </div>
      <s-box padding="base" borderWidth="base" borderRadius="base">
        <s-text>
          Product recommendations are pulled from each purchased product
          metafield: custom.recommended_products.
        </s-text>
      </s-box>
    </s-stack>
  );
}

function CheckoutUpsellFields({config}: {config: ThankYouBlockConfig}) {
  const shopify = useAppBridge();
  const [products, setProducts] = useState<CheckoutUpsellProduct[]>(
    Array.isArray(config.checkoutUpsellProducts)
      ? config.checkoutUpsellProducts
      : [],
  );

  const [offerSource, setOfferSource] = useState<CheckoutUpsellSource>(
    config.checkoutUpsellSource ||
      config.CheckoutUpsellSource ||
      "specific_products",
  );
  const [maxProducts, setMaxProducts] = useState(
    String(config.checkoutUpsellMaxProducts || 4),
  );

  const openProductPicker = async () => {
    const picker = (shopify as unknown as {
      resourcePicker?: (
        options: Record<string, unknown>,
      ) => Promise<unknown[] | undefined>;
    }).resourcePicker;

    if (!picker) {
      window.alert("Product picker is not available.");
      return;
    }

    const selection = await picker({
      type: "product",
      multiple: true,
      selectionIds: products.map((product) => ({
        id: product.id,
        variants: product.variants.map((variant) => ({id: variant.id})),
      })),
    });

    if (!selection) return;

    setProducts(
      selection
        .map(normalizePickedProduct)
        .filter(Boolean) as CheckoutUpsellProduct[],
    );
  };

  const removeProduct = (productId: string) => {
    setProducts((current) =>
      current.filter((product) => product.id !== productId),
    );
  };

  return (
    <s-stack gap="base">
      <div>
        <input
          type="hidden"
          name="checkoutUpsellSource"
          value={offerSource}
        />
        <label style={labelStyle} htmlFor="checkoutUpsellHeading">
          Section header
        </label>
        <input
          defaultValue={
            config.checkoutUpsellHeading || "You might also like these"
          }
          id="checkoutUpsellHeading"
          maxLength={80}
          name="checkoutUpsellHeading"
          style={fieldStyle}
          required
        />
      </div>
      <div
        style={{
          borderTop: "1px solid #e1e3e5",
          margin: "8px 0",
        }}
      />

      <ProductConditionFields config={config} />
      <div
        style={{
          borderTop: "1px solid #e1e3e5",
          margin: "8px 0",
        }}
      />

      <s-stack gap="small">
        <s-heading>Offers</s-heading>
        <s-text>
          The selected products will be shown when user is on checkout summary page.
        </s-text>

        <label>
          <input
            type="radio"
            checked={offerSource === "specific_products"}
            onChange={() => setOfferSource("specific_products")}
          />
          Specific Products
        </label>

        <label>
          <input
            type="radio"
            checked={offerSource === "related_products"}
            onChange={() => setOfferSource("related_products")}
          />
          Shopify recommendations
        </label>

        <label>
          <input
            type="radio"
            checked={offerSource === "collection"}
            onChange={() => setOfferSource("collection")}
          />
          Collection Recommendations
        </label>
      </s-stack>

      {offerSource !== "specific_products" && (
        <div>
          <label style={labelStyle} htmlFor="checkoutUpsellMaxProducts">
            Maximum Products to Show
          </label>
          <input
            id="checkoutUpsellMaxProducts"
            min={1}
            max={20}
            name="checkoutUpsellMaxProducts"
            onChange={(event) =>
              setMaxProducts((event.target as HTMLInputElement).value)
            }
            style={{...fieldStyle, maxWidth: "160px"}}
            type="number"
            value={maxProducts}
          />
        </div>
      )}

      {offerSource === "related_products" && (
        <s-box
          padding="base"
          borderWidth="base"
          borderRadius="base"
        >
          <s-text>
            Products will be recommended using Shopify&apos;s Related Products API based
            on the products currently in the customer&apos;s cart.
          </s-text>
        </s-box>
      )}

      {offerSource === "collection" && (
        <s-box
          padding="base"
          borderWidth="base"
          borderRadius="base"
        >
          <s-text>
            Products will be recommended from collections that contain products
            currently in the customer&apos;s cart.
          </s-text>
        </s-box>
      )}

      {offerSource === "specific_products" && (
         <>
          <input
            name="checkoutUpsellProducts"
            type="hidden"
            value={JSON.stringify(products)}
            readOnly
          />
          <s-stack gap="small">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                justifyContent: "space-between",
              }}
            >
              <s-heading>Products</s-heading>
              <button type="button" onClick={openProductPicker} style={submitStyle}>
                Browse products
              </button>
            </div>

            {products.length ? (
              <div style={{display: "grid", gap: "10px"}}>
                {products.map((product) => (
                  <div
                    key={product.id}
                    style={{
                      alignItems: "center",
                      border: "1px solid #d7dce0",
                      borderRadius: "8px",
                      display: "grid",
                      gap: "12px",
                      gridTemplateColumns: "48px minmax(0, 1fr) auto",
                      padding: "10px",
                    }}
                  >
                    {product.image ? (
                      <img
                        alt=""
                        src={product.image}
                        style={{
                          borderRadius: "6px",
                          height: "48px",
                          objectFit: "cover",
                          width: "48px",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          background: "#f1f2f4",
                          borderRadius: "6px",
                          height: "48px",
                          width: "48px",
                        }}
                      />
                    )}

                    <div style={{minWidth: 0}}>
                      <div
                        style={{
                          fontWeight: 650,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {product.title}
                      </div>
                      <div style={{color: "#616a75", fontSize: "12px"}}>
                        {product.variants.length} variant
                        {product.variants.length === 1 ? "" : "s"} available
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeProduct(product.id)}
                      style={{
                        background: "transparent",
                        border: 0,
                        color: "#d82c0d",
                        cursor: "pointer",
                        font: "inherit",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <s-box padding="base" borderWidth="base" borderRadius="base">
                <s-text color="subdued">
                  Select products to offer on the checkout page.
                </s-text>
              </s-box>
            )}
          </s-stack>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-text>
              Customers can add these products directly from checkout. Stores must
              allow cart line changes in checkout for the Add button to work.
            </s-text>
          </s-box>
       </>
      )}

    </s-stack>
  );
}

function ProductConditionFields({config}: {config: ThankYouBlockConfig}) {
  const shopify = useAppBridge();
  const initialCondition =
    config.productConditions?.[0] || defaultProductCondition();
  const [condition, setCondition] =
    useState<ProductCondition>(initialCondition);
  const valuesText = condition.values.map((value) => value.label).join(", ");

  const updateCondition = (next: Partial<ProductCondition>) => {
    setCondition((current) => ({
      ...current,
      ...next,
    }));
  };

  const openCollectionPicker = async () => {
    const picker = (shopify as unknown as {
      resourcePicker?: (
        options: Record<string, unknown>,
      ) => Promise<unknown[] | undefined>;
    }).resourcePicker;

    if (!picker) {
      window.alert("Collection picker is not available.");
      return;
    }

    const selection = await picker({
      type: "collection",
      multiple: true,
      selectionIds: condition.values
        .filter((value) => value.id)
        .map((value) => ({id: value.id})),
    });

    if (!selection) return;

    updateCondition({
      values: selection
        .map(normalizePickedCollection)
        .filter(Boolean) as ProductConditionValue[],
    });
  };

  const hiddenConditions =
    condition.type === "all" ? [] : condition.values.length ? [condition] : [];

  return (
    <s-stack gap="base">
      <s-heading>Trigger</s-heading>
      <s-text>
        Select the products for which the offer is displayed.
      </s-text>
      <input
        name="productConditions"
        type="hidden"
        value={JSON.stringify(hiddenConditions)}
        readOnly
      />

      {/* <div
        style={{
          border: "1px solid #d7dce0",
          borderRadius: "8px",
          display: "grid",
          gap: "12px",
          padding: "12px",
        }}
      > */}
        <div
          style={{
            display: "grid",
            gap: "12px",
            gridTemplateColumns:
              "minmax(130px, 0.75fr) minmax(130px, 0.75fr) minmax(220px, 2fr)",
          }}
        >
          <div>
            <label style={labelStyle} htmlFor="productConditionType">
              Condition
            </label>
            <select
              id="productConditionType"
              value={condition.type}
              onChange={(event) =>
                setCondition({
                  type: (event.target as HTMLSelectElement)
                    .value as ProductCondition["type"],
                  rule: condition.rule,
                  values: [],
                })
              }
              style={fieldStyle}
            >
              {/* <optgroup> */}
                {/* <option value="tags">Tags</option> */}
                <option value="all">
                  All Products
                </option>
                <option value="collections">Collections</option>
              {/* </optgroup> */}
            </select>
          </div>

         {condition.type === "collections" && (
          <>
          <div>
            <label style={labelStyle} htmlFor="productConditionRule">
              Type
            </label>
            <select
              id="productConditionRule"
              value={condition.rule}
              onChange={(event) =>
                updateCondition({
                  rule: (event.target as HTMLSelectElement)
                    .value as ProductCondition["rule"],
                })
              }
              style={fieldStyle}
            >
              <option value="include">Includes</option>
              <option value="exclude">Excludes</option>
            </select>
          </div>

          <div>
            <label style={labelStyle} htmlFor="productConditionValues">
              Value
            </label>
            <div style={{display: "grid", gap: "8px"}}>
              <button
                type="button"
                onClick={openCollectionPicker}
                style={secondaryButtonStyle}
              >
                Select collections
              </button>
              {condition.values.length ? (
                <div style={{color: "#616a75", fontSize: "13px"}}>
                  {valuesText}
                </div>
              ) : null}
            </div>
          </div>
          </>
          )}
        </div>
      {/* </div> */}
    </s-stack>
  );
}

function defaultProductCondition(): ProductCondition {
  return {
    type: "all",
    rule: "include",
    values: [],
  };
}

function normalizePickedCollection(value: unknown): ProductConditionValue | null {
  const collection =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : null;

  if (!collection) return null;

  const id = stringValue(collection.id);
  const label =
    stringValue(collection.title) ||
    stringValue(collection.handle) ||
    id;

  if (!label) return null;

  return {
    id,
    label,
    handle: stringValue(collection.handle),
  };
}

function normalizePickedProduct(value: unknown): CheckoutUpsellProduct | null {
  const product =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : null;

  if (!product) return null;

  const id = stringValue(product.id);
  const title = stringValue(product.title);
  const variants = Array.isArray(product.variants)
    ? product.variants
        .map((variant) => {
          const record =
            variant && typeof variant === "object"
              ? (variant as Record<string, unknown>)
              : {};

          return {
            id: stringValue(record.id),
            title: stringValue(record.title) || "Default",
            price: stringValue(record.price),
          };
        })
        .filter((variant) => variant.id)
    : [];

  if (!id || !title || !variants.length) return null;

  return {
    id,
    title,
    handle: stringValue(product.handle),
    image:
      firstImageUrl(product.images) ||
      firstImageUrl(product.featuredImage) ||
      "",
    tags: stringArray(product.tags),
    collections: normalizePickedCollections(product.collections),
    variants,
  };
}

function normalizePickedCollections(value: unknown): ProductConditionValue[] {
  if (!Array.isArray(value)) return [];

  return value
    .map(normalizePickedCollection)
    .filter(Boolean) as ProductConditionValue[];
}

function firstImageUrl(value: unknown) {
  const image = Array.isArray(value) ? value[0] : value;
  const record =
    image && typeof image === "object" ? (image as Record<string, unknown>) : {};

  return stringValue(record.originalSrc) || stringValue(record.url);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
