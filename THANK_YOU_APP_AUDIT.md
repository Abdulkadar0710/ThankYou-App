# Thank-You App Feature Audit & Bug Report

Here is a comprehensive audit of all features in the **Thank-You App**, covering feature verification, identified bugs, unfinished features, and configuration discrepancies.

---

## 1. Feature Map & Current Implementation Status

| Feature / Block                                  | Target Location      | Admin Editor Config          | Backend API / Webhook         | Extension Status                     |
| :----------------------------------------------- | :------------------- | :--------------------------- | :---------------------------- | :----------------------------------- |
| **Upsell Product Recommendations**               | Thank-You Page       | `UpsellFields`               | `/api/recommendations`        | Active (`thank-you-upsell`)          |
| **1-Click Upsell (Same Box / 0 Extra Shipping)** | Thank-You Page       | Built into Upsell Block      | `/api/add-to-order`           | Active with 10-min countdown timer   |
| **FAQ Accordion**                                | Thank-You Page       | `FaqFields`                  | `/api/blocks`                 | Active (`thank-you-faq`)             |
| **Image Banner**                                 | Thank-You Page       | `MediaFields`                | `/api/blocks`                 | Active (`thank-you-image`)           |
| **Video Banner**                                 | Thank-You Page       | `MediaFields`                | `/api/blocks`                 | Active (`thank-you-video`)           |
| **Discount Code**                                | Thank-You & Checkout | `DiscountFields`             | `/api/blocks`                 | Active (`thank-you-discount`)        |
| **Email Subscription**                           | Thank-You Page       | `SubscriptionFields`         | `/api/subscription-click`     | Active (`thank-you-subscription`)    |
| **Loyalty Program**                              | Thank-You Page       | `LoyaltyFields`              | `/api/blocks`                 | Active (`thank-you-loyalty`)         |
| **How Did You Hear About Us? (Survey)**          | Thank-You Page       | `HowDidYouHearFields`        | `/api/how-did-you-hear`       | Active (`how-did-you-hear-about-us`) |
| **Checkout Upsell**                              | Checkout Page        | `CheckoutUpsellFields`       | `/api/blocks`                 | Active (`checkout-upsell`)           |
| **Free Shipping Progress Bar**                   | Checkout Page        | `FreeShippingProgressFields` | `/api/shipping-threshold`     | Active (`free-shipping-progress`)    |
| **Gift Options (Wrap & Message)**                | Checkout Page        | `GiftOptionsFields`          | `/api/gift-wrap-variants`     | Active (`gift-options`)              |
| **Click & Interaction Analytics**                | Embedded Admin       | `/app/analytics`             | `/api/analytics-click`        | Active                               |
| **Money Made Dashboard**                         | Embedded Admin       | `/app/money-made`            | Webhooks + `upsellConversion` | Active (with mock fallbacks)         |
| **Help & Documentation**                         | Embedded Admin       | `/app/help`                  | N/A                           | Active                               |

---

## 2. Identified Bugs

### 🔴 Critical Bugs

1. **Silent Save Failure / Navigation on Error in Block Editor**
   - **Location**: [ThankYouBlockEditor.tsx](file:///home/gwl/Downloads/August-2026/thanks-new/app/components/ThankYouBlockEditor.tsx#L237-L244)
   - **Issue**: Error checking on form submission is commented out:
     ```tsx
     // if (!response.ok || !result?.success) {
     //   setSaveError(result?.errors?.join(" ") || result?.message || "Could not save block.");
     //   return;
     // }
     navigate(result?.redirectTo || "/app/blocks");
     ```
   - **Impact**: If the backend returns `400 Bad Request`, `409 Conflict`, or `500 Server Error`, the editor silently ignores the error and navigates the merchant to `/app/blocks` as if the save succeeded. Leftover debug text `"Could not save block2."` is also present on line 248.

2. **MySQL Database Crash on Image File Upload (Base64 vs `TEXT` limit)**
   - **Location**: [ThankYouBlockEditor.tsx](file:///home/gwl/Downloads/August-2026/thanks-new/app/components/ThankYouBlockEditor.tsx#L773-L789) & [schema.prisma](file:///home/gwl/Downloads/August-2026/thanks-new/prisma/schema.prisma#L56)
   - **Issue**: The file picker allows uploading images up to 1,000 KB encoded as Base64 Data URLs. However, `ThankYouBlock.config` is defined in Prisma as `@db.Text`. In MySQL, standard `TEXT` has a hard limit of **65,535 bytes (64 KB)**.
   - **Impact**: Uploading any image larger than ~48 KB fails with a MySQL error: `Data too long for column 'config' at row 1`, breaking block saves. (Prisma schema should use `@db.MediumText` or `@db.LongText`).

3. **Hardcoded Dev Store Product ID in Gift Options API**
   - **Location**: [api.gift-wrap-variants.jsx](file:///home/gwl/Downloads/August-2026/thanks-new/app/routes/api.gift-wrap-variants.jsx#L4-L5)
   - **Issue**: `const GIFT_WRAP_PRODUCT_ID = 'gid://shopify/Product/8283468398681';` is hardcoded to the developer test store.
   - **Impact**: On any other merchant store, the product will not exist, returning `"Gift wrap product not found"`. When customers check "Add gift wrap" in checkout, it will display the error `"Could not load gift wrap options."`


---

### 🟡 Medium & Minor Bugs

5. **`replaceReferralVariables` Can Inject `"undefined"`** `[FIXED]`
   - **Location**: [extensions/thank-you-loyalty/src/index.jsx](file:///home/gwl/Downloads/August-2026/thanks-new/extensions/thank-you-loyalty/src/index.jsx#L134) & [extensions/thank-you-referral/src/index.jsx](file:///home/gwl/Downloads/August-2026/thanks-new/extensions/thank-you-referral/src/index.jsx#L134)
   - **Status**: Fixed. Added type guards and fallback to empty string `trimText(cfg.referralLink) || ''`.

6. **Invalid HTML Elements in `ThankYouBlockEditor.tsx`** `[FIXED]`
   - **Location**: [ThankYouBlockEditor.tsx:L709](file:///home/gwl/Downloads/August-2026/thanks-new/app/components/ThankYouBlockEditor.tsx#L709), [L796](file:///home/gwl/Downloads/August-2026/thanks-new/app/components/ThankYouBlockEditor.tsx#L796), and [L1511](file:///home/gwl/Downloads/August-2026/thanks-new/app/components/ThankYouBlockEditor.tsx#L1511)
   - **Status**: Fixed. Replaced `<text>` with standard Polaris `<s-text color="subdued">` and replaced `width={70}` on input with `maxLength={80}`.

7. **Template Preview Broken Link in `app.blocks._index.tsx`** `[FIXED]`
   - **Location**: [app.blocks._index.tsx:L198](file:///home/gwl/Downloads/August-2026/thanks-new/app/routes/app.blocks._index.tsx#L198)
   - **Status**: Fixed. Updated path to existing valid asset `/image-preview.png`.

---

## 3. Unfinished & Incomplete Features

1. **"How Did You Hear About Us?" Responses Have No Admin View**
   - **Status**: Answers are successfully saved to the database table `HowDidYouHearResponse` via [api.how-did-you-hear.jsx](file:///home/gwl/Downloads/August-2026/thanks-new/app/routes/api.how-did-you-hear.jsx).
   - **Unfinished**: There is **no UI anywhere in the Admin panel** ([app.analytics.tsx](file:///home/gwl/Downloads/August-2026/thanks-new/app/routes/app.analytics.tsx) or [app._index.tsx](file:///home/gwl/Downloads/August-2026/thanks-new/app/routes/app._index.tsx)) for merchants to view survey tallies, breakdown percentages, or order attributions.

2. **Money Made Dashboard Hardcoded Demo Data Fallback**
   - **Location**: [app.money-made.tsx:L223-L228](file:///home/gwl/Downloads/August-2026/thanks-new/app/routes/app.money-made.tsx#L223-L228) and [L442-L458](file:///home/gwl/Downloads/August-2026/thanks-new/app/routes/app.money-made.tsx#L442-L458)
   - **Unfinished**: When a store has `0` conversions recorded (`!hasLiveData`), it displays hardcoded demo revenue ($3,305.00 total, $2,480 1-click upsell, $680 discount, $145 gift wrap) and mock orders `#1042` and `#1041` instead of an empty state.
   - **Unused Data**: `repeatLogs` is calculated in the loader and returned to the page, but is never rendered anywhere in the JSX.
   - **Churn Rate**: `churnRate` always falls back to `3.2%` because `subscriptionStatus` is never updated anywhere in the codebase.

3. **Free Shipping Progress Bar Manual Threshold is Not Exposed in Admin**
   - **Location**: [extensions/free-shipping-progress/src/index.jsx:L126](file:///home/gwl/Downloads/August-2026/thanks-new/extensions/free-shipping-progress/src/index.jsx#L126) and [api.shipping-threshold.jsx:L138](file:///home/gwl/Downloads/August-2026/thanks-new/app/routes/api.shipping-threshold.jsx#L138)
   - **Unfinished**: The extension and backend API both contain fallback logic expecting `config.freeShippingThreshold` and `config.freeShippingMethodRules`. However, the Admin Editor (`FreeShippingProgressFields`) has **no input fields** for threshold or shipping method rules, and `thankYouBlock.ts` does not parse them.

4. **Discount Code "Click to Copy" Unfinished**
   - **Location**: [extensions/thank-you-discount/src/index.jsx:L22](file:///home/gwl/Downloads/August-2026/thanks-new/extensions/thank-you-discount/src/index.jsx#L22)
   - **Unfinished**: `const [copied, setCopied] = useState(false);` is defined, but neither is ever used. There is no copy-to-clipboard button or click event, despite [app.help.tsx](file:///home/gwl/Downloads/August-2026/thanks-new/app/routes/app.help.tsx#L238) stating _"Customers can copy it with one click."_

5. **Unused Prisma Model `DailyRevenueAggregate`**
   - **Location**: [prisma/schema.prisma:L116-L135](file:///home/gwl/Downloads/August-2026/thanks-new/prisma/schema.prisma#L116-L135)
   - **Unfinished**: A full aggregate table schema is defined in Prisma, but it is never populated, updated, or queried anywhere in the application.

6. **Abandoned Directory `extensions/thank-you-survey`**
   - **Location**: `extensions/thank-you-survey`
   - **Unfinished**: Contains only an empty `dist/` folder with no extension definition (`shopify.extension.toml`). It has been replaced by `extensions/how-did-you-hear-about-us` and can be cleaned up.

7. **Product Conditions "Tags" Trigger Disabled**
   - **Location**: [ThankYouBlockEditor.tsx:L1920](file:///home/gwl/Downloads/August-2026/thanks-new/app/components/ThankYouBlockEditor.tsx#L1920)
   - **Unfinished**: The documentation in `app.help.tsx` mentions filtering upsell offers by collections or tags, but `<option value="tags">Tags</option>` is commented out in the editor.

---

## 4. Suggested Next Steps

1. **Uncomment error handling in [ThankYouBlockEditor.tsx](file:///home/gwl/Downloads/August-2026/thanks-new/app/components/ThankYouBlockEditor.tsx#L237)** so merchants receive clear error messages if a block save fails.
2. **Update Prisma Schema** for `ThankYouBlock.config` from `@db.Text` to `@db.MediumText` or `@db.LongText` so image uploads up to 1MB do not trigger database truncation errors.
3. **Make Gift Wrap configurable** or add an automated product lookup by handle/tag instead of the hardcoded `GIFT_WRAP_PRODUCT_ID`.
4. **Add a Free Shipping Threshold field** in `FreeShippingProgressFields` so merchants can specify a threshold directly from the app.
5. **Add a "How Did You Hear" response breakdown card** to [app.analytics.tsx](file:///home/gwl/Downloads/August-2026/thanks-new/app/routes/app.analytics.tsx).
6. **Add an empty state to [app.money-made.tsx](file:///home/gwl/Downloads/August-2026/thanks-new/app/routes/app.money-made.tsx)** when conversions equal zero.
