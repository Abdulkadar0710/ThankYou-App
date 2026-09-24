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
      <s-section heading="Feature Blocks Guide">
        <s-stack gap="base">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="small">
              <s-heading>How Did You Hear About Us? (Post-Purchase Survey)</s-heading>
              <s-paragraph>
                Collect attribution insights directly from buyers right after they
                place an order.
              </s-paragraph>
              <ul style={{ margin: "4px 0 0 18px", padding: 0, lineHeight: 1.6 }}>
                <li>Customize multiple-choice options (e.g. Social Media, Ads, Search Engine, Other).</li>
                <li>Add, remove, or reorder options at any time from the block editor.</li>
                <li>Responses are saved automatically with Order ID and customer choices.</li>
              </ul>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="small">
              <s-heading>Post-Purchase & Checkout Upsells</s-heading>
              <s-paragraph>
                Increase your Average Order Value (AOV) by offering complementary items
                that customers can add to their order with a single click.
              </s-paragraph>
              <ul style={{ margin: "4px 0 0 18px", padding: 0, lineHeight: 1.6 }}>
                <li>Recommend specific products or target collections.</li>
                <li>Real-time revenue tracking appears in the Money Made dashboard.</li>
              </ul>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="small">
              <s-heading>Discount Code Offer</s-heading>
              <s-paragraph>
                Incentivize repeat business by showing an exclusive coupon code for their next purchase.
              </s-paragraph>
              <ul style={{ margin: "4px 0 0 18px", padding: 0, lineHeight: 1.6 }}>
                <li>Customize title, description, and discount voucher code.</li>
                <li>Includes an easy one-click copy button for shoppers.</li>
              </ul>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="small">
              <s-heading>FAQ Accordion</s-heading>
              <s-paragraph>
                Reassure customers after purchase by addressing shipping times, return policies,
                and contact instructions right on the thank-you screen.
              </s-paragraph>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="small">
              <s-heading>Free Shipping Progress Bar & Gift Options</s-heading>
              <s-paragraph>
                Display remaining threshold amounts to encourage higher cart totals, and
                allow customers to add gift wrapping or custom messages during checkout.
              </s-paragraph>
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

      {/* Support Card */}
      <s-section heading="Need Assistance?">
        <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
          <s-stack gap="small">
            <s-heading>We're here to help</s-heading>
            <s-paragraph>
              Have a question, need a custom block, or running into an issue? Our team is available to assist you.
            </s-paragraph>
            <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
              <s-button href="/app/blocks">Manage Blocks</s-button>
              <s-button href="/app/analytics">View Analytics</s-button>
            </div>
          </s-stack>
        </s-box>
      </s-section>
    </s-page>
  );
}
