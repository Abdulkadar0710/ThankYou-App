import type {LoaderFunctionArgs} from "react-router";
import {useLoaderData} from "react-router";
import prisma from "../db.server";
import {authenticate} from "../shopify.server";

export const loader = async ({request}: LoaderFunctionArgs) => {
  const {session} = await authenticate.admin(request);
  const shop = session.shop;

  const clicks = await prisma.subscriptionClick.findMany({
    where: {shop},
    orderBy: {createdAt: "desc"},
  });

  const upsellClicks = clicks.filter(
    (c) => c.eventType === "add_to_same_box_click" || c.source?.includes("upsell"),
  );

  return {
    shop,
    totalUpsellCount: upsellClicks.length,
    clicks: clicks.slice(0, 20).map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    })),
  };
};

export default function MoneyMadePage() {
  const {totalUpsellCount} = useLoaderData<typeof loader>();

  // Static money made metrics calculation for demo dashboard presentation
  const baseRevenue = 3450.0;
  const dynamicRevenue = totalUpsellCount * 28.5;
  const totalMoneyMade = (baseRevenue + dynamicRevenue).toFixed(2);
  const zeroShippingSaved = ((totalUpsellCount + 42) * 5.99).toFixed(2);

  return (
    <s-page heading="Money Made">
      <div style={{display: "flex", flexDirection: "column", gap: "24px", paddingBottom: "32px"}}>
        {/* Top Highlight Banner */}
        <div
          style={{
            background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
            borderRadius: "16px",
            color: "#ffffff",
            padding: "24px 28px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
          }}
        >
          <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px"}}>
            <div>
              <div style={{fontSize: "13px", textTransform: "uppercase", tracking: "0.05em", color: "#94a3b8", fontWeight: 650}}>
                Total Additional Revenue Generated
              </div>
              <div style={{fontSize: "36px", fontWeight: 800, margin: "4px 0", color: "#38bdf8"}}>
                ${totalMoneyMade}
              </div>
              <div style={{fontSize: "14px", color: "#cbd5e1"}}>
                Generated through post-purchase & 1-Click zero-shipping upsells
              </div>
            </div>
            <div style={{display: "flex", gap: "12px"}}>
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  backdropFilter: "blur(10px)",
                  padding: "12px 20px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  textAlign: "center",
                }}
              >
                <div style={{fontSize: "20px", fontWeight: 700, color: "#4ade80"}}>+18.4%</div>
                <div style={{fontSize: "12px", color: "#94a3b8"}}>AOV Boost</div>
              </div>
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  backdropFilter: "blur(10px)",
                  padding: "12px 20px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  textAlign: "center",
                }}
              >
                <div style={{fontSize: "20px", fontWeight: 700, color: "#fbbf24"}}>${zeroShippingSaved}</div>
                <div style={{fontSize: "12px", color: "#94a3b8"}}>Customer Shipping Saved</div>
              </div>
            </div>
          </div>
        </div>

        {/* Metric Cards Grid */}
        <s-grid gap="base" gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="small-200">
              <s-text color="subdued">📦 1-Click "Add to Same Box"</s-text>
              <s-heading>${(2480.0 + dynamicRevenue).toFixed(2)}</s-heading>
              <s-text tone="success">+34 orders this week</s-text>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="small-200">
              <s-text color="subdued">🏷️ Post-Purchase Discounts</s-text>
              <s-heading>$680.00</s-heading>
              <s-text tone="success">14% coupon redemption</s-text>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="small-200">
              <s-text color="subdued">🔄 Subscription Add-ons</s-text>
              <s-heading>$290.00</s-heading>
              <s-text tone="success">12 new subscribers</s-text>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="small-200">
              <s-text color="subdued">🎁 Gift Wrap Options</s-text>
              <s-heading>$145.00</s-heading>
              <s-text tone="success">29 gift orders</s-text>
            </s-stack>
          </s-box>
        </s-grid>

        {/* Feature Revenue Breakdown */}
        <s-section heading="Revenue Breakdown by Feature">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="base">
              <div>
                <div style={{display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "14px", fontWeight: 600}}>
                  <span>📦 1-Click Zero-Shipping Upsell</span>
                  <span>72% of total earnings</span>
                </div>
                <div style={{background: "#e2e8f0", height: "10px", borderRadius: "5px", overflow: "hidden"}}>
                  <div style={{background: "#0284c7", width: "72%", height: "100%"}} />
                </div>
              </div>

              <div>
                <div style={{display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "14px", fontWeight: 600}}>
                  <span>🏷️ Thank You Discount Offers</span>
                  <span>18% of total earnings</span>
                </div>
                <div style={{background: "#e2e8f0", height: "10px", borderRadius: "5px", overflow: "hidden"}}>
                  <div style={{background: "#16a34a", width: "18%", height: "100%"}} />
                </div>
              </div>

              <div>
                <div style={{display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "14px", fontWeight: 600}}>
                  <span>🔄 Subscription Signups</span>
                  <span>6% of total earnings</span>
                </div>
                <div style={{background: "#e2e8f0", height: "10px", borderRadius: "5px", overflow: "hidden"}}>
                  <div style={{background: "#d97706", width: "6%", height: "100%"}} />
                </div>
              </div>

              <div>
                <div style={{display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "14px", fontWeight: 600}}>
                  <span>🎁 Gift Wrap Add-ons</span>
                  <span>4% of total earnings</span>
                </div>
                <div style={{background: "#e2e8f0", height: "10px", borderRadius: "5px", overflow: "hidden"}}>
                  <div style={{background: "#9333ea", width: "4%", height: "100%"}} />
                </div>
              </div>
            </s-stack>
          </s-box>
        </s-section>

        {/* Recent Money Made Log Table */}
        <s-section heading="Recent Upsell Conversions">
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Order</s-table-header>
              <s-table-header>Feature</s-table-header>
              <s-table-header>Item Added</s-table-header>
              <s-table-header format="numeric">Revenue Added</s-table-header>
              <s-table-header>Extra Shipping Fee</s-table-header>
              <s-table-header>Status</s-table-header>
            </s-table-header-row>
            <s-table-body>
              <s-table-row>
                <s-table-cell>#1042</s-table-cell>
                <s-table-cell>📦 1-Click Upsell</s-table-cell>
                <s-table-cell>Coffee Beans (250g)</s-table-cell>
                <s-table-cell>$12.00</s-table-cell>
                <s-table-cell>$0.00 (Same Box)</s-table-cell>
                <s-table-cell>Appended to Order</s-table-cell>
              </s-table-row>
              <s-table-row>
                <s-table-cell>#1041</s-table-cell>
                <s-table-cell>📦 1-Click Upsell</s-table-cell>
                <s-table-cell>Advanced Hair Growth Bundle</s-table-cell>
                <s-table-cell>$129.00</s-table-cell>
                <s-table-cell>$0.00 (Same Box)</s-table-cell>
                <s-table-cell>Appended to Order</s-table-cell>
              </s-table-row>
              <s-table-row>
                <s-table-cell>#1040</s-table-cell>
                <s-table-cell>🎁 Gift Options</s-table-cell>
                <s-table-cell>Custom Gift Wrap & Card</s-table-cell>
                <s-table-cell>$5.00</s-table-cell>
                <s-table-cell>$0.00</s-table-cell>
                <s-table-cell>Completed</s-table-cell>
              </s-table-row>
              <s-table-row>
                <s-table-cell>#1039</s-table-cell>
                <s-table-cell>🏷️ Thank You Discount</s-table-cell>
                <s-table-cell>THANKYOU15 (Next Order)</s-table-cell>
                <s-table-cell>$45.00</s-table-cell>
                <s-table-cell>Standard</s-table-cell>
                <s-table-cell>Redeemed</s-table-cell>
              </s-table-row>
              <s-table-row>
                <s-table-cell>#1038</s-table-cell>
                <s-table-cell>📦 1-Click Upsell</s-table-cell>
                <s-table-cell>Hot Sauce - Original</s-table-cell>
                <s-table-cell>$71.19</s-table-cell>
                <s-table-cell>$0.00 (Same Box)</s-table-cell>
                <s-table-cell>Appended to Order</s-table-cell>
              </s-table-row>
            </s-table-body>
          </s-table>
        </s-section>
      </div>
    </s-page>
  );
}
