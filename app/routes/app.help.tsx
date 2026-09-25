import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { checkoutEditorUrl } from "../utils/checkoutEditor.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const checkoutCustomizeUrl = await checkoutEditorUrl(session.shop, admin);

  return {
    shop: session.shop,
    checkoutCustomizeUrl,
  };
};

export default function HelpPage() {
  const { checkoutCustomizeUrl } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Help & Documentation">
      <s-button
        slot="primary-action"
        href={checkoutCustomizeUrl}
        target="_blank"
      >
        Customize Thank You Page
      </s-button>

      {/* Quick Start Overview */}
      <s-section heading="Quick Start Guide">
        <s-grid
          gap="base"
          gridTemplateColumns="repeat(auto-fit, minmax(240px, 1fr))"
        >
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-stack gap="small">
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#202223",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "14px",
                }}
              >
                1
              </div>
              <s-heading>Create or Choose a Block</s-heading>
              <s-paragraph>
                Go to the <strong>Blocks</strong> page and choose a feature template
                like "How did you hear about us?", Upsell, FAQ, or Discount code.
              </s-paragraph>
              <s-link href="/app/blocks">Go to Blocks &rarr;</s-link>
            </s-stack>
          </s-box>

          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-stack gap="small">
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#202223",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "14px",
                }}
              >
                2
              </div>
              <s-heading>Add to Thank You Page</s-heading>
              <s-paragraph>
                Open the Shopify Checkout Editor and add the corresponding app block
                to your <strong>Thank you</strong> or <strong>Order status</strong> page.
              </s-paragraph>
              <s-link href={checkoutCustomizeUrl} target="_blank">
                Open Editor &rarr;
              </s-link>
            </s-stack>
          </s-box>

          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-stack gap="small">
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#202223",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "14px",
                }}
              >
                3
              </div>
              <s-heading>Activate & Monitor</s-heading>
              <s-paragraph>
                Set the block status to <strong>Active</strong>. Responses and
                interactions are tracked live in your Analytics and Money Made tabs.
              </s-paragraph>
              <s-link href="/app/analytics">View Analytics &rarr;</s-link>
            </s-stack>
          </s-box>
        </s-grid>
      </s-section>

      {/* Feature Blocks Guide */}
      <s-section heading="Feature Blocks Guide & Configuration Details">
        <s-stack gap="base">
          {/* Image Block */}
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="small">
              <s-heading>1. Image Block</s-heading>
              <s-paragraph>
                Display custom marketing banners, brand thank-you graphics, warranty badges, or promotional images on the thank-you page.
              </s-paragraph>
              <s-box padding="small" background="subdued" borderRadius="base">
                <s-stack gap="small-200">
                  <s-text type="strong">Configuration Fields:</s-text>
                  <ul style={{ margin: "4px 0 0 18px", padding: 0, lineHeight: 1.6 }}>
                    <li><strong>Section Header:</strong> Optional title displayed above the image banner.</li>
                    <li><strong>Image URL:</strong> Direct public link to your hosted banner or product graphic (e.g. from Shopify Files: <em>Settings &gt; Files</em>).</li>
                    <li><strong>Image Alt Text:</strong> Descriptive accessibility text for screen readers and SEO.</li>
                    <li><strong>Image Link (Optional):</strong> Web URL where customers will be redirected when clicking the image (e.g. your blog, VIP community, or collection).</li>
                    <li><strong>Status:</strong> Set to <em>Active</em> to show live to shoppers, or <em>Draft</em> to hide.</li>
                  </ul>
                </s-stack>
              </s-box>
            </s-stack>
          </s-box>

          {/* Video Block */}
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="small">
              <s-heading>2. Video Block</s-heading>
              <s-paragraph>
                Embed a video message—such as a founder thank-you note, product setup tutorial, or unboxing guide—directly on the post-purchase thank-you screen.
              </s-paragraph>
              <s-box padding="small" background="subdued" borderRadius="base">
                <s-stack gap="small-200">
                  <s-text type="strong">Configuration Fields:</s-text>
                  <ul style={{ margin: "4px 0 0 18px", padding: 0, lineHeight: 1.6 }}>
                    <li><strong>Video Title:</strong> Heading displayed above the video (e.g. <em>"A message from our founder"</em> or <em>"How to get started"</em>).</li>
                    <li><strong>Video URL:</strong> Link to your video source (YouTube, Vimeo, or direct MP4 link).</li>
                    <li><strong>Video Thumbnail Image URL:</strong> High-resolution cover image shown before the customer plays the video.</li>
                    <li><strong>Status:</strong> Set to <em>Active</em> to publish or <em>Draft</em> to temporarily pause.</li>
                  </ul>
                </s-stack>
              </s-box>
            </s-stack>
          </s-box>

          {/* How Did You Hear About Us? */}
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="small">
              <s-heading>3. How Did You Hear About Us? (Attribution Survey)</s-heading>
              <s-paragraph>
                Collect post-purchase marketing channel feedback from buyers directly on the thank-you screen to know what channels drive real paying customers.
              </s-paragraph>
              <s-box padding="small" background="subdued" borderRadius="base">
                <s-stack gap="small-200">
                  <s-text type="strong">Configuration Fields:</s-text>
                  <ul style={{ margin: "4px 0 0 18px", padding: 0, lineHeight: 1.6 }}>
                    <li><strong>Section Header:</strong> The question shown to buyers (e.g. <em>"How did you hear about us?"</em>).</li>
                    <li><strong>Options List:</strong> Dynamic list of choices (e.g. <em>Ads</em>, <em>Social Media</em>, <em>Search Engine</em>, <em>Friend or Family</em>, <em>Other</em>). Use the <em>+ Add option</em> and <em>✕</em> buttons to customize choices.</li>
                    <li><strong>Button Text:</strong> Label on the submission button (default: <em>Submit</em>).</li>
                    <li><strong>Success Message:</strong> Confirmation message shown after answering (default: <em>Thank you for your feedback!</em>).</li>
                    <li><strong>Storage:</strong> Answers are saved in your store's dedicated <code>HowDidYouHearResponse</code> database table with Order ID and customer response.</li>
                  </ul>
                </s-stack>
              </s-box>
            </s-stack>
          </s-box>

          {/* Checkout & Thank You Upsells */}
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="small">
              <s-heading>4. Checkout & Thank You Page Upsells</s-heading>
              <s-paragraph>
                Offer relevant cross-sell or upsell products that customers can add directly to their existing order without re-entering payment info.
              </s-paragraph>
              <s-box padding="small" background="subdued" borderRadius="base">
                <s-stack gap="small-200">
                  <s-text type="strong">Configuration Fields:</s-text>
                  <ul style={{ margin: "4px 0 0 18px", padding: 0, lineHeight: 1.6 }}>
                    <li><strong>Section Header:</strong> Title like <em>"You might also like these"</em> or <em>"Exclusive Add-On"</em>.</li>
                    <li><strong>Upsell Source:</strong> Choose between <em>Specific Products</em>, <em>Related Products</em>, or a designated <em>Collection</em>.</li>
                    <li><strong>Max Products to Display:</strong> Number of product cards to display (1 to 4 items).</li>
                    <li><strong>Trigger Conditions:</strong> Target all shoppers or trigger only when order contains items from specific collections or tags.</li>
                    <li><strong>Tracking:</strong> Conversions and incremental revenue auto-sync with the <em>Money Made</em> dashboard.</li>
                  </ul>
                </s-stack>
              </s-box>
            </s-stack>
          </s-box>

          {/* Discount Code */}
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="small">
              <s-heading>5. Discount Code</s-heading>
              <s-paragraph>
                Incentivize prompt repeat purchases by offering an exclusive discount voucher on the thank-you confirmation page.
              </s-paragraph>
              <s-box padding="small" background="subdued" borderRadius="base">
                <s-stack gap="small-200">
                  <s-text type="strong">Configuration Fields:</s-text>
                  <ul style={{ margin: "4px 0 0 18px", padding: 0, lineHeight: 1.6 }}>
                    <li><strong>Title:</strong> Header above the voucher (e.g. <em>"A gift for your next order"</em>).</li>
                    <li><strong>Description:</strong> Instructions or terms (e.g. <em>"Use this code on your next purchase:"</em>).</li>
                    <li><strong>Discount Code:</strong> The exact coupon code created in your Shopify Admin (e.g. <em>THANKYOU10</em>). Customers can copy it with one click.</li>
                  </ul>
                </s-stack>
              </s-box>
            </s-stack>
          </s-box>

          {/* FAQ Accordion */}
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="small">
              <s-heading>6. FAQ Accordion</s-heading>
              <s-paragraph>
                Reduce support tickets by answering top questions regarding order tracking, shipping windows, and return policies right after checkout.
              </s-paragraph>
              <s-box padding="small" background="subdued" borderRadius="base">
                <s-stack gap="small-200">
                  <s-text type="strong">Configuration Fields:</s-text>
                  <ul style={{ margin: "4px 0 0 18px", padding: 0, lineHeight: 1.6 }}>
                    <li><strong>Section Header:</strong> Section title (default: <em>"Frequently asked questions"</em>).</li>
                    <li><strong>Accordion Items:</strong> Manage up to multiple Q&amp;A items with customizable question titles and rich answer text.</li>
                    <li><strong>Add/Remove:</strong> Add new question cards or delete outdated ones with a single click.</li>
                  </ul>
                </s-stack>
              </s-box>
            </s-stack>
          </s-box>

          {/* Free Shipping Progress Bar */}
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="small">
              <s-heading>7. Free Shipping Progress Bar</s-heading>
              <s-paragraph>
                Motivate customers in checkout to add more items to reach your free shipping minimum threshold.
              </s-paragraph>
              <s-box padding="small" background="subdued" borderRadius="base">
                <s-stack gap="small-200">
                  <s-text type="strong">Configuration Fields:</s-text>
                  <ul style={{ margin: "4px 0 0 18px", padding: 0, lineHeight: 1.6 }}>
                    <li><strong>Section Header:</strong> Title like <em>"Free shipping"</em>.</li>
                    <li><strong>Remaining Message:</strong> Text displayed when under threshold, using the <code>{"{amount}"}</code> placeholder (e.g. <em>"You're {"{amount}"} away from free shipping."</em>).</li>
                    <li><strong>Success Message:</strong> Congratulations message displayed once free shipping is unlocked (e.g. <em>"You've unlocked free shipping."</em>).</li>
                  </ul>
                </s-stack>
              </s-box>
            </s-stack>
          </s-box>

          {/* Gift Options */}
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="small">
              <s-heading>8. Gift Options (Wrap & Message)</s-heading>
              <s-paragraph>
                Let customers select premium gift wrapping and compose a personalized message during checkout.
              </s-paragraph>
              <s-box padding="small" background="subdued" borderRadius="base">
                <s-stack gap="small-200">
                  <s-text type="strong">Configuration Fields:</s-text>
                  <ul style={{ margin: "4px 0 0 18px", padding: 0, lineHeight: 1.6 }}>
                    <li><strong>Section Header:</strong> Title (default: <em>"Gift options"</em>).</li>
                    <li><strong>Gift Wrap Checkbox:</strong> Enable or disable gift wrapping option; set custom label (e.g. <em>"Add gift wrap"</em>).</li>
                    <li><strong>Gift Message Checkbox:</strong> Enable or disable recipient notes; set label and placeholder (e.g. <em>"Write a message for the recipient"</em>).</li>
                  </ul>
                </s-stack>
              </s-box>
            </s-stack>
          </s-box>

          {/* Loyalty & Referral Offers */}
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="small">
              <s-heading>9. Loyalty Program & Referral Blocks</s-heading>
              <s-paragraph>
                Drive customer retention by inviting new buyers to sign up for rewards points or refer their friends for mutual store discounts.
              </s-paragraph>
              <s-box padding="small" background="subdued" borderRadius="base">
                <s-stack gap="small-200">
                  <s-text type="strong">Configuration Fields:</s-text>
                  <ul style={{ margin: "4px 0 0 18px", padding: 0, lineHeight: 1.6 }}>
                    <li><strong>Loyalty:</strong> Customize headline, points badge (e.g. <em>"2x points"</em>), promotional description, and external sign-up button URL.</li>
                    <li><strong>Referral:</strong> Set friend reward discount (e.g. <em>"15%"</em>), advocate store credit (e.g. <em>"$10"</em>), referral promo code, and share link.</li>
                  </ul>
                </s-stack>
              </s-box>
            </s-stack>
          </s-box>

          {/* Subscription Signup */}
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="small">
              <s-heading>10. Subscription Signup</s-heading>
              <s-paragraph>
                Capture buyer email interest for recurring delivery subscriptions right after an order is placed.
              </s-paragraph>
              <s-box padding="small" background="subdued" borderRadius="base">
                <s-stack gap="small-200">
                  <s-text type="strong">Configuration Fields:</s-text>
                  <ul style={{ margin: "4px 0 0 18px", padding: 0, lineHeight: 1.6 }}>
                    <li><strong>Headline &amp; Body:</strong> Promotional pitch (e.g. <em>"Never run out again - Subscribe for 15% off recurring orders"</em>).</li>
                    <li><strong>Input Placeholder &amp; Button:</strong> Email field placeholder and submit button label (e.g. <em>"Subscribe"</em>).</li>
                    <li><strong>Confirmation:</strong> Success message displayed upon opt-in.</li>
                  </ul>
                </s-stack>
              </s-box>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      {/* Step-by-Step: Adding Blocks to Checkout */}
      <s-section heading="How to Add Blocks in Shopify Checkout Editor">
        <s-box padding="base" borderWidth="base" borderRadius="base">
          <s-stack gap="base">
            <s-paragraph>
              Follow these simple steps to place blocks on your store's Thank You or Order Status pages:
            </s-paragraph>
            <ol style={{ margin: "0 0 0 20px", padding: 0, lineHeight: 1.8 }}>
              <li>
                Click the <strong>Customize Thank You Page</strong> button above (or navigate in Shopify Admin to <em>Settings &gt; Checkout &gt; Configurations &gt; Customize</em>).
              </li>
              <li>
                In the top page dropdown of the theme customizer, select <strong>Thank you</strong> (or <strong>Order status</strong>).
              </li>
              <li>
                In the left sidebar, click <strong>Add block</strong> (or <strong>Add section</strong>).
              </li>
              <li>
                Look for the <strong>Apps</strong> tab and select the desired block (e.g. <em>How did you hear about us?</em>, <em>Thank You - Upsell Section</em>, etc.).
              </li>
              <li>
                Drag the block to your preferred position on the page and click <strong>Save</strong> in the top right.
              </li>
            </ol>
          </s-stack>
        </s-box>
      </s-section>

      {/* Frequently Asked Questions */}
      <s-section heading="Frequently Asked Questions (FAQ)">
        <s-stack gap="base">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="small-200">
              <s-text type="strong">Why is my block not showing up on the thank-you page?</s-text>
              <s-paragraph>
                Please verify two things:
                <br />
                1. Make sure you added the block in the Shopify Checkout Editor and saved the page.
                <br />
                2. In the <strong>Blocks</strong> tab of this app, check that the block status is set to <strong>Active</strong> (draft blocks are hidden from customers).
              </s-paragraph>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="small-200">
              <s-text type="strong">Can I edit the survey options in "How did you hear about us"?</s-text>
              <s-paragraph>
                Yes! Go to <strong>Blocks</strong> &gt; click <strong>Edit</strong> on the survey block &gt; and you can add, rename, or delete any options. Changes apply immediately.
              </s-paragraph>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="small-200">
              <s-text type="strong">How do I temporarily hide a block without deleting it?</s-text>
              <s-paragraph>
                Simply edit the block in the <strong>Blocks</strong> tab, switch the status dropdown from <strong>Active</strong> to <strong>Draft</strong>, and click <strong>Save</strong>.
              </s-paragraph>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="small-200">
              <s-text type="strong">Where can I see customer responses and revenue?</s-text>
              <s-paragraph>
                Visit the <strong>Analytics</strong> tab to see interaction counts and survey metrics, and the <strong>Money Made</strong> tab for financial conversions and order upsells.
              </s-paragraph>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

    </s-page>
  );
}
