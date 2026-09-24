export type ThankYouBlockType =
  | "faq"
  | "image"
  | "video"
  | "media"
  | "upsell"
  | "checkoutUpsell"
  | "freeShippingProgress"
  | "giftOptions"
  | "referral"
  | "loyalty"
  | "discount"
  | "subscription"
  | "howDidYouHear";

export type CheckoutUpsellProduct = {
  id: string;
  title: string;
  handle?: string;
  image?: string;
  tags?: string[];
  collections?: ProductConditionValue[];
  variants: Array<{
    id: string;
    title: string;
    price?: string;
  }>;
};
export type CheckoutUpsellSource =
  | "specific_products"
  | "related_products"
  | "collection";

export type ProductConditionType = "all" | "tags" | "collections";
export type ProductConditionRule = "include" | "exclude";
export type ProductConditionValue = {
  id?: string;
  label: string;
  handle?: string;
};
export type ProductCondition = {
  type: ProductConditionType;
  rule: ProductConditionRule;
  values: ProductConditionValue[];
};

export type ThankYouBlockConfig = {
  heading?: string;
  items?: Array<{question: string; answer: string}>;
  mediaType?: "image" | "video";
  imageUrl?: string;
  imageAlt?: string;
  imageLink?: string;
  videoUrl?: string;
  videoThumbnail?: string;
  upsellHeading?: string;
  emptyMessage?: string;
  productConditions?: ProductCondition[];
  checkoutUpsellHeading?: string;
  checkoutUpsellProducts?: CheckoutUpsellProduct[];
  checkoutUpsellSource?: CheckoutUpsellSource;
  CheckoutUpsellSource?: CheckoutUpsellSource;
  checkoutUpsellMaxProducts?: number;
  freeShippingHeading?: string;
  freeShippingSuccessMessage?: string;
  freeShippingRemainingMessage?: string;
  giftOptionsHeading?: string;
  giftWrapEnabled?: boolean;
  giftMessageEnabled?: boolean;
  giftWrapLabel?: string;
  giftMessageLabel?: string;
  giftMessagePlaceholder?: string;
  title?: string;
  description?: string;
  buttonText?: string;
  buttonUrl?: string;
  shareLabel?: string;
  shareText?: string;
  referralCode?: string;
  referralLink?: string;
  friendReward?: string;
  advocateReward?: string;
  pointsText?: string;
  validUntil?: string;
  discountCode?: string;
  subscriptionHeading?: string;
  subscriptionBody?: string;
  emailPlaceholder?: string;
  successMessage?: string;
};

export const blockTemplates = {
  faq: {
    type: "faq",
    title: "FAQ Accordion",
    description: "Surface common questions post-purchase.",
    defaultName: "FAQ Accordion",
    defaultConfig: {
      heading: "Frequently asked questions",
      items: [],
    },
  },
  image: {
    type: "image",
    title: "Image Block",
    description: "Show a static image on the thank-you page.",
    defaultName: "Image Block",
    defaultConfig: {
      heading: "",
      imageUrl: "",
      imageAlt: "",
      imageLink: "",
    },
  },
  video: {
    type: "video",
    title: "Video Block",
    description: "Show a video title, thumbnail, and link after purchase.",
    defaultName: "Video Block",
    defaultConfig: {
      heading: "Watch this",
      videoUrl: "",
      videoThumbnail: "",
    },
  },
  media: {
    type: "media",
    title: "Image / Video",
    description: "Legacy combined image or video block.",
    defaultName: "Image / Video",
    defaultConfig: {},
    deprecated: true,
  },
  upsell: {
    type: "upsell",
    title: "Thank You Page Upsell",
    description: "Recommend products from purchased product metafields.",
    defaultName: "Thank You Page Upsell",
    defaultConfig: {},
  },
  checkoutUpsell: {
    type: "checkoutUpsell",
    title: "Checkout Upsell",
    description: "Show selected products on checkout with an add-to-cart button.",
    defaultName: "Checkout Upsell",
    defaultConfig: {
      checkoutUpsellHeading: "You might also like these",
      checkoutUpsellProducts: [],
      checkoutUpsellSource: "specific_products",
      checkoutUpsellMaxProducts: 4,
    },
  },
  freeShippingProgress: {
    type: "freeShippingProgress",
    title: "Free Shipping Progress Bar",
    description: "Show checkout progress toward a free shipping threshold.",
    defaultName: "Free Shipping Progress Bar",
    defaultConfig: {
      freeShippingHeading: "Free shipping",
      freeShippingRemainingMessage: "You're {amount} away from free shipping.",
      freeShippingSuccessMessage: "You've unlocked free shipping.",
    },
  },
  giftOptions: {
    type: "giftOptions",
    title: "Gift Options",
    description: "Collect gift wrap and gift message choices in checkout.",
    defaultName: "Gift Options",
    defaultConfig: {
      giftOptionsHeading: "Gift options",
      giftWrapEnabled: true,
      giftMessageEnabled: true,
      giftWrapLabel: "Add gift wrap",
      giftMessageLabel: "Gift message",
      giftMessagePlaceholder: "Write a message for the recipient",
    },
  },
  discount: {
    type: "discount",
    title: "Discount Code",
    description: "Show a discount code for a future purchase.",
    defaultName: "Discount Code",
    defaultConfig: {
      title: "Discount code",
      description: "Use this code on your next purchase:",
      discountCode: "",
    },
  },
  referral: {
    type: "referral",
    title: "Referral Offer",
    description: "Invite customers to share your store with friends.",
    defaultName: "Referral Offer",
    defaultConfig: {
      title: "Refer friends. Get rewards.",
      description:
        "Give your friends {friend_reward} off all products. Get {advocate_reward} off all products when they purchase with your discount code {referral_code}.",
      shareLabel: "Share now:",
      shareText: "Share",
      referralCode: "THANKYOU15",
      referralLink: "",
      friendReward: "15%",
      advocateReward: "$10",
    },
  },
  loyalty: {
    type: "loyalty",
    title: "Loyalty Offer",
    description: "Promote points, rewards, or account signups after purchase.",
    defaultName: "Loyalty Offer",
    defaultConfig: {
      title: "Join our loyalty program",
      description:
        "Earn 2x points on future purchases and unlock member-only rewards.",
      buttonText: "Join now",
      buttonUrl: "",
      pointsText: "2x points",
      validUntil: "",
    },
  },
  subscription: {
    type: "subscription",
    title: "Subscription Signup",
    description: "Collect subscription interest from thank-you page visitors.",
    defaultName: "Subscription Signup",
    defaultConfig: {
      subscriptionHeading: "Never run out again",
      subscriptionBody: "Subscribe and get exclusive savings on every order.",
      buttonText: "Subscribe",
      emailPlaceholder: "Email address",
      successMessage: "Thanks for subscribing.",
    },
  },
  howDidYouHear: {
    type: "howDidYouHear",
    title: "How did you hear about us?",
    description: "Ask customers how they heard about your store.",
    defaultName: "How did you hear about us?",
    defaultConfig: {
      heading: "How did you hear about us?",
    },
  },
} as const;

export function isBlockType(value: unknown): value is ThankYouBlockType {
  return (
    value === "faq" ||
    value === "image" ||
    value === "video" ||
    value === "media" ||
    value === "upsell" ||
    value === "checkoutUpsell" ||
    value === "freeShippingProgress" ||
    value === "giftOptions" ||
    value === "referral" ||
    value === "loyalty" ||
    value === "discount" ||
    value === "subscription" ||
    value === "howDidYouHear"
  );
}

export function parseBlockConfig(value?: string | null): ThankYouBlockConfig {
  if (!value) return {};

  try {
    return JSON.parse(value) as ThankYouBlockConfig;
  } catch {
    return {};
  }
}

export function configFromForm(
  type: ThankYouBlockType,
  formData: FormData,
): ThankYouBlockConfig {
  if (type === "faq") {
    return {
      heading: field(formData, "heading"),
      items: faqItemsFromForm(formData),
    };
  }

  if (type === "image" || type === "video" || type === "media") {
    const mediaType =
      type === "video" || field(formData, "mediaType") === "video"
        ? "video"
        : "image";

    return {
      heading: field(formData, "heading"),
      mediaType,
      imageUrl: field(formData, "imageUrl"),
      imageAlt: field(formData, "imageAlt"),
      imageLink: field(formData, "imageLink"),
      videoUrl: field(formData, "videoUrl"),
      videoThumbnail: field(formData, "videoThumbnail"),
    };
  }

  if (type === "referral") {
    return {
      title: field(formData, "title"),
      description: field(formData, "description"),
      shareLabel: field(formData, "shareLabel"),
      shareText: field(formData, "shareText"),
      referralCode: field(formData, "referralCode"),
      referralLink: field(formData, "referralLink"),
      friendReward: field(formData, "friendReward"),
      advocateReward: field(formData, "advocateReward"),
    };
  }

  if (type === "discount") {
    return {
      title: field(formData, "title"),
      description: field(formData, "description"),
      discountCode: field(formData, "discountCode"),
    };
  }

  if (type === "loyalty") {
    return {
      title: field(formData, "title"),
      description: field(formData, "description"),
      buttonText: field(formData, "buttonText"),
      buttonUrl: field(formData, "buttonUrl"),
      pointsText: field(formData, "pointsText"),
      validUntil: field(formData, "validUntil"),
    };
  }

  if (type === "subscription") {
    return {
      subscriptionHeading: field(formData, "subscriptionHeading"),
      subscriptionBody: field(formData, "subscriptionBody"),
      buttonText: field(formData, "buttonText"),
      emailPlaceholder: field(formData, "emailPlaceholder"),
      successMessage: field(formData, "successMessage"),
    };
  }

  if (type === "checkoutUpsell") {
    return {
      checkoutUpsellHeading: field(formData, "checkoutUpsellHeading"),
      checkoutUpsellSource: checkoutUpsellSourceFromForm(formData),
      checkoutUpsellMaxProducts: checkoutUpsellMaxProductsFromForm(formData),
      checkoutUpsellProducts: checkoutUpsellProductsFromForm(formData),
      productConditions: productConditionsFromForm(formData),
    };
  }

  if (type === "freeShippingProgress") {
    return {
      freeShippingHeading: field(formData, "freeShippingHeading"),
      freeShippingRemainingMessage: field(
        formData,
        "freeShippingRemainingMessage",
      ),
      freeShippingSuccessMessage: field(
        formData,
        "freeShippingSuccessMessage",
      ),
    };
  }

  if (type === "giftOptions") {
    return {
      giftOptionsHeading: field(formData, "giftOptionsHeading"),
      giftWrapEnabled: formData.get("giftWrapEnabled") === "on",
      giftMessageEnabled: formData.get("giftMessageEnabled") === "on",
      giftWrapLabel: field(formData, "giftWrapLabel"),
      giftMessageLabel: field(formData, "giftMessageLabel"),
      giftMessagePlaceholder: field(formData, "giftMessagePlaceholder"),
    };
  }

  if (type === "howDidYouHear") {
    return {
      heading: field(formData, "heading"),
    };
  }

  return {
    upsellHeading: field(formData, "upsellHeading"),
    emptyMessage: field(formData, "emptyMessage"),
    productConditions: productConditionsFromForm(formData),
  };
}

export function validateBlockForm(
  type: ThankYouBlockType,
  formData: FormData,
) {
  const errors: string[] = [];

  if (type === "faq") {
    const items = faqItemsFromForm(formData);

    if (!items.length) {
      errors.push("Add at least one FAQ question and answer.");
    }

    items.forEach((item, index) => {
      const position = index + 1;

      if (!item.question) {
        errors.push(`FAQ ${position} question is required.`);
      }

      if (!item.answer) {
        errors.push(`FAQ ${position} answer is required.`);
      }
    });
  }

  if (type === "image" || type === "video" || type === "media") {
    const mediaType =
      type === "video" || field(formData, "mediaType") === "video"
        ? "video"
        : "image";

    if (mediaType === "image") {
      requireImageSource(errors, formData, "imageUrl", "Image URL");
      optionalUrl(errors, formData, "imageLink", "Image link");
    } else {
      requireUrl(errors, formData, "videoUrl", "Video URL");
      requireImageSource(errors, formData, "videoThumbnail", "Thumbnail image URL");
    }
  }

  if (type === "discount") {
    requireText(errors, formData, "title", "Title");
    requireText(errors, formData, "description", "Description");
    requireText(errors, formData, "discountCode", "Discount code");
  }

  if (type === "loyalty") {
    requireText(errors, formData, "title", "Title");
    requireText(errors, formData, "description", "Description");
    requireText(errors, formData, "pointsText", "Points badge");
    requireText(errors, formData, "buttonText", "Button text");
    requireUrl(errors, formData, "buttonUrl", "Button link");
  }

  if (type === "subscription") {
    requireText(errors, formData, "subscriptionHeading", "Heading");
    requireText(errors, formData, "subscriptionBody", "Description");
    requireText(errors, formData, "buttonText", "Button text");
    requireText(errors, formData, "emailPlaceholder", "Email placeholder");
    requireText(errors, formData, "successMessage", "Success message");
  }

  if (type === "checkoutUpsell") {
    requireText(errors, formData, "checkoutUpsellHeading", "Section header");

    const checkoutUpsellSource = checkoutUpsellSourceFromForm(formData);

    if (
      checkoutUpsellSource === "specific_products" &&
      !checkoutUpsellProductsFromForm(formData).length
    ) {
      errors.push("Select at least one checkout upsell product.");
    }

    if (
      checkoutUpsellSource !== "specific_products" &&
      checkoutUpsellMaxProductsFromForm(formData) < 1
    ) {
      errors.push("Maximum products to show must be at least 1.");
    }
  }

  if (type === "freeShippingProgress") {
    requireText(errors, formData, "freeShippingHeading", "Heading");
    requireText(
      errors,
      formData,
      "freeShippingRemainingMessage",
      "Remaining amount message",
    );
    requireText(
      errors,
      formData,
      "freeShippingSuccessMessage",
      "Success message",
    );
  }

  if (type === "giftOptions") {
    const giftWrapEnabled = formData.get("giftWrapEnabled") === "on";
    const giftMessageEnabled = formData.get("giftMessageEnabled") === "on";

    requireText(errors, formData, "giftOptionsHeading", "Heading");

    if (!giftWrapEnabled && !giftMessageEnabled) {
      errors.push("Enable gift wrap, gift message, or both.");
    }

    if (giftWrapEnabled) {
      requireText(errors, formData, "giftWrapLabel", "Gift wrap label");
    }

    if (giftMessageEnabled) {
      requireText(errors, formData, "giftMessageLabel", "Gift message label");
    }
  }

  if (type === "howDidYouHear") {
    requireText(errors, formData, "heading", "Heading");
  }

  if (type === "upsell" || type === "checkoutUpsell") {
    productConditionsFromForm(formData).forEach((condition, index) => {
      if (condition.type !== "all" && !condition.values.length) {
        errors.push(`Condition ${index + 1} needs at least one value.`);
      }
    });
  }

  return {
    success: errors.length === 0,
    errors,
    message: errors[0] || "",
  };
}

export function field(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value.trim() : "";
}

function requireText(
  errors: string[],
  formData: FormData,
  name: string,
  label: string,
) {
  if (!textContent(field(formData, name))) {
    errors.push(`${label} is required.`);
  }
}

function requireUrl(
  errors: string[],
  formData: FormData,
  name: string,
  label: string,
) {
  const value = field(formData, name);

  if (!value) {
    errors.push(`${label} is required.`);
    return;
  }

  if (!isValidUrl(value)) {
    errors.push(`${label} must be a valid URL.`);
  }
}

function requireImageSource(
  errors: string[],
  formData: FormData,
  name: string,
  label: string,
) {
  const value = field(formData, name);

  if (!value) {
    errors.push(`${label} is required.`);
    return;
  }

  if (!isValidUrl(value) && !isValidImageDataUrl(value)) {
    errors.push(`${label} must be a valid URL or uploaded image.`);
  }
}

function optionalUrl(
  errors: string[],
  formData: FormData,
  name: string,
  label: string,
) {
  const value = field(formData, name);

  if (value && !isValidUrl(value)) {
    errors.push(`${label} must be a valid URL.`);
  }
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidImageDataUrl(value: string) {
  return /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/]+=*$/i.test(
    value,
  );
}

function textContent(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function faqItemsFromForm(formData: FormData) {
  const indexedItems = Array.from(formData.entries()).reduce<
    Array<{question: string; answer: string}>
  >((items, [name, value]) => {
    if (typeof value !== "string") return items;

    const match = name.match(/^(question|answer)_(\d+)$/);
    if (!match) return items;

    const index = Number(match[2]);
    items[index] = items[index] || {question: "", answer: ""};
    items[index][match[1] as "question" | "answer"] = value.trim();

    return items;
  }, []);

  const visibleItems = indexedItems.filter(
    (item) => item?.question || item?.answer,
  );

  if (visibleItems.length) return visibleItems;

  const faqData = formData.get("faq_data");

  if (!faqData) return [];

  try {
    const parsed = JSON.parse(String(faqData));

    return Array.isArray(parsed)
      ? parsed.map((item: unknown) => {
          const faq =
            item && typeof item === "object"
              ? (item as {question?: unknown; answer?: unknown})
              : {};

          return {
            question:
              typeof faq.question === "string" ? faq.question.trim() : "",
            answer: typeof faq.answer === "string" ? faq.answer.trim() : "",
          };
        })
      : [];
  } catch (error) {
    console.error("Failed to parse FAQ data:", error);
    return [];
  }
}

function checkoutUpsellProductsFromForm(formData: FormData) {
  const value = field(formData, "checkoutUpsellProducts");

  if (!value) return [];

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item: unknown) => {
        const product =
          item && typeof item === "object"
            ? (item as CheckoutUpsellProduct)
            : null;

        if (!product?.id || !product?.title) return null;

        const variants = Array.isArray(product.variants)
          ? product.variants
              .map((variant) => ({
                id: typeof variant.id === "string" ? variant.id : "",
                title:
                  typeof variant.title === "string" ? variant.title : "Default",
                price:
                  typeof variant.price === "string" ? variant.price : "",
              }))
              .filter((variant) => variant.id)
          : [];

        if (!variants.length) return null;

        return {
          id: String(product.id),
          title: String(product.title).trim(),
          handle:
            typeof product.handle === "string" ? product.handle.trim() : "",
          image:
            typeof product.image === "string" ? product.image.trim() : "",
          tags: stringArray(product.tags),
          collections: productConditionValues(product.collections),
          variants,
        };
      })
      .filter(Boolean) as CheckoutUpsellProduct[];
  } catch (error) {
    console.error("Failed to parse checkout upsell products:", error);
    return [];
  }
}

function checkoutUpsellSourceFromForm(formData: FormData): CheckoutUpsellSource {
  const value = field(formData, "checkoutUpsellSource");

  if (value === "related_products" || value === "collection") {
    return value;
  }

  return "specific_products";
}

function checkoutUpsellMaxProductsFromForm(formData: FormData) {
  const value = Number(field(formData, "checkoutUpsellMaxProducts"));

  if (!Number.isFinite(value)) return 4;

  return Math.max(1, Math.min(20, Math.floor(value)));
}

function productConditionsFromForm(formData: FormData): ProductCondition[] {
  const value = field(formData, "productConditions");

  if (!value) return [];

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item: unknown) => {
        const condition =
          item && typeof item === "object"
            ? (item as {
                type?: unknown;
                rule?: unknown;
                values?: unknown;
              })
            : {};
        const type =
          condition.type === "all"
            ? "all"
            : condition.type === "collections"
              ? "collections"
              : "tags";
        const rule =
          condition.rule === "exclude" ? "exclude" : "include";
        const values = productConditionValues(condition.values);

        if (type === "all") {
          return {
            type,
            rule: "include",
            values: [],
          };
        }

        if (!values.length) return null;

        return {
          type,
          rule,
          values,
        };
      })
      .filter(Boolean) as ProductCondition[];
  } catch (error) {
    console.error("Failed to parse product conditions:", error);
    return [];
  }
}

function productConditionValues(value: unknown): ProductConditionValue[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") {
        const label = item.trim();

        return label ? {label} : null;
      }

      const record =
        item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const label =
        stringField(record.label) ||
        stringField(record.title) ||
        stringField(record.handle) ||
        stringField(record.id);

      if (!label) return null;

      return {
        id: stringField(record.id),
        label,
        handle: stringField(record.handle),
      };
    })
    .filter(Boolean) as ProductConditionValue[];
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function stringField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
