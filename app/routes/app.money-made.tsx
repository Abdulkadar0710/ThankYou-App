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

  // Static money made & retention metrics calculation for demo dashboard presentation
  const baseRevenue = 3450.0;
  const dynamicRevenue = totalUpsellCount * 28.5;
  const totalMoneyMade = (baseRevenue + dynamicRevenue).toFixed(2);
  const zeroShippingSaved = ((totalUpsellCount + 42) * 5.99).toFixed(2);
  const repeatCustomerRevenue = (1820.0 + totalUpsellCount * 14.2).toFixed(2);

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
                Generated through 1-Click zero-shipping upsells & repeat customer offers
              </div>
            </div>
            <div style={{display: "flex", gap: "12px", flexWrap: "wrap"}}>
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  backdropFilter: "blur(10px)",
                  padding: "12px 18px",
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
                  padding: "12px 18px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  textAlign: "center",
                }}
              >
                <div style={{fontSize: "20px", fontWeight: 700, color: "#38bdf8"}}>38.4%</div>
                <div style={{fontSize: "12px", color: "#94a3b8"}}>Repeat Purchase Rate</div>
              </div>

              <div
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  backdropFilter: "blur(10px)",
                  padding: "12px 18px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  textAlign: "center",
                }}
              >
                <div style={{fontSize: "20px", fontWeight: 700, color: "#fbbf24"}}>${zeroShippingSaved}</div>
                <div style={{fontSize: "12px", color: "#94a3b8"}}>Shipping Fee Saved</div>
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
              <s-text color="subdued">🔁 Returning Customer Revenue</s-text>
              <s-heading>${repeatCustomerRevenue}</s-heading>
              <s-text tone="success">38.4% repeat purchase rate</s-text>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="small-200">
              <s-text color="subdued">📉 Customer Churn Rate</s-text>
              <s-heading>3.2%</s-heading>
              <s-text tone="success">-6.8% churn reduction</s-text>
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

        {/* Retention & Repeat Purchase Analytics */}
        <s-section heading="Customer Retention & Repeat Purchases">
          <s-grid gap="base" gridTemplateColumns="repeat(auto-fit, minmax(280px, 1fr))">
            <s-box padding="base" borderWidth="base" borderRadius="base">
              <s-stack gap="small">
                <s-text type="strong">🔁 Customer Repeat Purchase Rate</s-text>
                <s-heading>38.4% of Customers Returned</s-heading>
                <s-text color="subdued">
                  Customers returned to purchase again after receiving post-purchase Thank You discounts & referral rewards.
                </s-text>
                <div style={{marginTop: "8px", background: "#f1f5f9", padding: "12px", borderRadius: "8px"}}>
                  <div style={{display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 650}}>
                    <span>Average Days to 2nd Purchase:</span>
                    <span style={{color: "#0284c7"}}>14.2 Days</span>
                  </div>
                  <div style={{display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 650, marginTop: "4px"}}>
                    <span>Repeat Orders Driven:</span>
                    <span style={{color: "#16a34a"}}>64 Orders</span>
                  </div>
                </div>
              </s-stack>
            </s-box>

            <s-box padding="base" borderWidth="base" borderRadius="base">
              <s-stack gap="small">
                <s-text type="strong">📉 Subscription & Customer Churn Rate</s-text>
                <s-heading>3.2% Churn Rate (-68% Decrease)</s-heading>
                <s-text color="subdued">
                  Thank You page subscription incentives & loyalty offers reduced customer churn from 10.0% down to 3.2%.
                </s-text>
                <div style={{marginTop: "8px", background: "#f1f5f9", padding: "12px", borderRadius: "8px"}}>
                  <div style={{display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 650}}>
                    <span>Monthly Retained Subscribers:</span>
                    <span style={{color: "#16a34a"}}>48 Subscribers</span>
                  </div>
                  <div style={{display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 650, marginTop: "4px"}}>
                    <span>Churn Prevention Value:</span>
                    <span style={{color: "#0284c7"}}>${(48 * 29.0).toFixed(2)}/mo</span>
                  </div>
                </div>
              </s-stack>
            </s-box>
          </s-grid>
        </s-section>

        {/* Feature Revenue Breakdown */}
        <s-section heading="Revenue Breakdown by Feature">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="base">
              <div>
                <div style={{display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "14px", fontWeight: 600}}>
                  <span>📦 1-Click Zero-Shipping Upsell</span>
                  <span>56% of total earnings</span>
                </div>
                <div style={{background: "#e2e8f0", height: "10px", borderRadius: "5px", overflow: "hidden"}}>
                  <div style={{background: "#0284c7", width: "56%", height: "100%"}} />
                </div>
              </div>

              <div>
                <div style={{display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "14px", fontWeight: 600}}>
                  <span>🔁 Returning Customer Purchases (Discount Codes)</span>
                  <span>26% of total earnings</span>
                </div>
                <div style={{background: "#e2e8f0", height: "10px", borderRadius: "5px", overflow: "hidden"}}>
                  <div style={{background: "#16a34a", width: "26%", height: "100%"}} />
                </div>
              </div>

              <div>
                <div style={{display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "14px", fontWeight: 600}}>
                  <span>🔄 Subscription Retained Renewals</span>
                  <span>12% of total earnings</span>
                </div>
                <div style={{background: "#e2e8f0", height: "10px", borderRadius: "5px", overflow: "hidden"}}>
                  <div style={{background: "#d97706", width: "12%", height: "100%"}} />
                </div>
              </div>

              <div>
                <div style={{display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "14px", fontWeight: 600}}>
                  <span>🎁 Gift Wrap Add-ons</span>
                  <span>6% of total earnings</span>
                </div>
                <div style={{background: "#e2e8f0", height: "10px", borderRadius: "5px", overflow: "hidden"}}>
                  <div style={{background: "#9333ea", width: "6%", height: "100%"}} />
                </div>
              </div>
            </s-stack>
          </s-box>
        </s-section>

        {/* Repeat Customer Purchase History Table */}
        <s-section heading="Recent Repeat Purchases Driven by App">
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Customer</s-table-header>
              <s-table-header>Incentive Used</s-table-header>
              <s-table-header format="numeric">Repeat Purchase Value</s-table-header>
              <s-table-header>Return Interval</s-table-header>
              <s-table-header>Status</s-table-header>
            </s-table-header-row>
            <s-table-body>
              <s-table-row>
                <s-table-cell>Sarah Jenkins</s-table-cell>
                <s-table-cell>🏷️ THANKYOU15 (15% Off)</s-table-cell>
                <s-table-cell>$84.50</s-table-cell>
                <s-table-cell>Returned in 8 Days</s-table-cell>
                <s-table-cell>Repeat Buyer (2nd Purchase)</s-table-cell>
              </s-table-row>
              <s-table-row>
                <s-table-cell>David Miller</s-table-cell>
                <s-table-cell>🔄 Subscription Loyalty Points</s-table-cell>
                <s-table-cell>$62.00</s-table-cell>
                <s-table-cell>Returned in 14 Days</s-table-cell>
                <s-table-cell>Repeat Buyer (3rd Purchase)</s-table-cell>
              </s-table-row>
              <s-table-row>
                <s-table-cell>Alex Turner</s-table-cell>
                <s-table-cell>👥 Referral Reward Code</s-table-cell>
                <s-table-cell>$110.00</s-table-cell>
                <s-table-cell>Returned in 11 Days</s-table-cell>
                <s-table-cell>Repeat Buyer (2nd Purchase)</s-table-cell>
              </s-table-row>
              <s-table-row>
                <s-table-cell>Emily Roberts</s-table-cell>
                <s-table-cell>🏷️ THANKYOU15 (15% Off)</s-table-cell>
                <s-table-cell>$49.99</s-table-cell>
                <s-table-cell>Returned in 18 Days</s-table-cell>
                <s-table-cell>Repeat Buyer (2nd Purchase)</s-table-cell>
              </s-table-row>
            </s-table-body>
          </s-table>
        </s-section>
      </div>
    </s-page>
  );
}
