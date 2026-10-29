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
| **Promotion**                                    | Thank-You Page       | `PromotionFields`            | `/api/blocks`                 | Active (`thank-you-promotion`)       |
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

---

## 3. Unfinished & Incomplete Features

1. **"How Did You Hear About Us?" Responses Have No Admin View**
   - **Status**: Answers are successfully saved to the database table `HowDidYouHearResponse` via [api.how-did-you-hear.jsx](file:///home/gwl/Downloads/August-2026/thanks-new/app/routes/api.how-did-you-hear.jsx).
   - **Unfinished**: There is **no UI anywhere in the Admin panel** ([app.analytics.tsx](file:///home/gwl/Downloads/August-2026/thanks-new/app/routes/app.analytics.tsx) or [app._index.tsx](file:///home/gwl/Downloads/August-2026/thanks-new/app/routes/app._index.tsx)) for merchants to view survey tallies, breakdown percentages, or order attributions.

2. **Money Made Dashboard Hardcoded Demo Data Fallback** `[FIXED]`
   - **Location**: [app.money-made.tsx](file:///home/gwl/Downloads/August-2026/thanks-new/app/routes/app.money-made.tsx)
   - **Status**: Fixed. Removed artificial revenue fallbacks ($2,480, $680, $145, 15 count) so real store data ($0.00 when empty) is displayed. Replaced fake demo order rows (#1042, #1041) with a proper empty state. Rendered `repeatLogs` into a "Repeat Customer Purchases" section and surfaced `repeatPurchaseRate` and `totalShippingFeeSaved` in the dashboard banner. Fixed fake rate fallbacks to `"0.0"`.

3. **Free Shipping Progress Bar Manual Threshold is Not Exposed in Admin**
   - **Location**: [extensions/free-shipping-progress/src/index.jsx:L126](file:///home/gwl/Downloads/August-2026/thanks-new/extensions/free-shipping-progress/src/index.jsx#L126) and [api.shipping-threshold.jsx:L138](file:///home/gwl/Downloads/August-2026/thanks-new/app/routes/api.shipping-threshold.jsx#L138)
   - **Unfinished**: The extension and backend API both contain fallback logic expecting `config.freeShippingThreshold` and `config.freeShippingMethodRules`. However, the Admin Editor (`FreeShippingProgressFields`) has **no input fields** for threshold or shipping method rules, and `thankYouBlock.ts` does not parse them.

4. **Discount Code "Click to Copy" Unfinished** `[FIXED]`
   - **Location**: [extensions/thank-you-discount/src/index.jsx](file:///home/gwl/Downloads/August-2026/thanks-new/extensions/thank-you-discount/src/index.jsx)
   - **Status**: Fixed. Added an interactive `<s-button>` with a `handleCopy` handler using `navigator.clipboard.writeText` and fallback. Connected `copied` state to toggle button text between "Copy code" and "Copied!" for 2 seconds. Also added discount code preview to `BlockPreview` in [ThankYouBlockEditor.tsx](file:///home/gwl/Downloads/August-2026/thanks-new/app/components/ThankYouBlockEditor.tsx).

5. **Unused Prisma Model `DailyRevenueAggregate`** `[FIXED]`
   - **Location**: [prisma/schema.prisma](file:///home/gwl/Downloads/August-2026/thanks-new/prisma/schema.prisma)
   - **Status**: Fixed. Removed unused model definition and synced the Prisma schema with the database via `npx prisma db push`.

6. **Abandoned Directory `extensions/thank-you-survey`** `[CLEANED]`
   - **Location**: `extensions/thank-you-survey`
   - **Status**: Verified cleaned up. The obsolete folder has been removed and superseded by `extensions/how-did-you-hear-about-us`.

7. **Product Conditions "Tags" Trigger Disabled** `[FIXED]`
   - **Location**: [ThankYouBlockEditor.tsx](file:///home/gwl/Downloads/August-2026/thanks-new/app/components/ThankYouBlockEditor.tsx)
   - **Status**: Fixed. Enabled `<option value="tags">Tags</option>` in the Trigger condition selector and added a comma-separated tag input field. Tags are parsed into `ProductConditionValue[]` and properly evaluated against line-item product tags in both `api.recommendations.jsx` and `checkout-upsell`.

---

## 4. Suggested Next Steps

1. **Uncomment error handling in [ThankYouBlockEditor.tsx](file:///home/gwl/Downloads/August-2026/thanks-new/app/components/ThankYouBlockEditor.tsx#L237)** so merchants receive clear error messages if a block save fails.
2. **Update Prisma Schema** for `ThankYouBlock.config` from `@db.Text` to `@db.MediumText` or `@db.LongText` so image uploads up to 1MB do not trigger database truncation errors.
3. **Make Gift Wrap configurable** or add an automated product lookup by handle/tag instead of the hardcoded `GIFT_WRAP_PRODUCT_ID`.
4. **Add a Free Shipping Threshold field** in `FreeShippingProgressFields` so merchants can specify a threshold directly from the app.
5. **Add a "How Did You Hear" response breakdown card** to [app.analytics.tsx](file:///home/gwl/Downloads/August-2026/thanks-new/app/routes/app.analytics.tsx).
6. ~~**Add an empty state to [app.money-made.tsx](file:///home/gwl/Downloads/August-2026/thanks-new/app/routes/app.money-made.tsx)** when conversions equal zero.~~ `[DONE]`
