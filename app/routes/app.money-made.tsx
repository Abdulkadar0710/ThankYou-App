import {useState, useEffect} from "react";
import type {ActionFunctionArgs, LoaderFunctionArgs} from "react-router";
import {useFetcher, useLoaderData, useSearchParams} from "react-router";
import prisma from "../db.server";
import {authenticate} from "../shopify.server";

export const action = async ({request}: ActionFunctionArgs) => {
  const {admin, session} = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "sync_orders") {
    let syncedCount = 0;
    try {
      const ordersRes = await admin.graphql(
        `
          query GetRecentOrdersForMoneyMade {
            orders(first: 50, sortKey: CREATED_AT, reverse: true) {
              nodes {
                id
                name
                cancelledAt
                displayFinancialStatus
                totalPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                customer {
                  id
                  email
                  numberOfOrders
                  amountSpent {
                    amount
                    currencyCode
                  }
                }
                discountCodes
                customAttributes {
                  key
                  value
                }
                lineItems(first: 20) {
                  nodes {
                    title
                    name
                    variantTitle
                    quantity
                    originalUnitPriceSet {
                      shopMoney {
                        amount
                      }
                    }
                    variant {
                      id
                      title
                    }
                    customAttributes {
                      key
                      value
                    }
                  }
                }
                createdAt
              }
            }
          }
        `,
      );
      const ordersData = await ordersRes.json();
      const shopifyOrders = ordersData?.data?.orders?.nodes || [];

      for (const order of shopifyOrders) {
        const orderId = order.id;
        const orderNumber = order.name;
        const orderAmount = parseFloat(order.totalPriceSet?.shopMoney?.amount || "0") || 0;
        const currency = order.totalPriceSet?.shopMoney?.currencyCode || "USD";
        const customerId = order.customer?.id || null;
        const customerEmail = order.customer?.email || null;
        const orderFinancialStatus = order.cancelledAt
          ? "CANCELLED"
          : (order.displayFinancialStatus || "PAID");

        // Sync latest status to any existing earnings logs for this order
        await prisma.earningsLog.updateMany({
          where: {shop, orderId},
          data: {status: orderFinancialStatus},
        });

        if (order.cancelledAt) {
          continue;
        }

        // 1. Sync Discount Codes
        const discountCodes = Array.isArray(order.discountCodes) ? order.discountCodes : [];
        if (discountCodes.length) {
          const code = discountCodes[0];
          const existingDiscount = await prisma.earningsLog.findFirst({
            where: {shop, orderId, featureType: "DISCOUNT_CODE"},
          });

          if (!existingDiscount) {
            await prisma.earningsLog.create({
              data: {
                shop,
                orderId,
                orderNumber,
                customerId,
                customerEmail,
                featureType: "DISCOUNT_CODE",
                itemTitle: `Discount Redeemed: ${code}`,
                amount: orderAmount,
                currency,
                discountCode: code,
                status: orderFinancialStatus,
              },
            });
            syncedCount++;
          }
        }

        // 2. Sync Gift Wrap Add-ons
        const customAttrs = Array.isArray(order.customAttributes) ? order.customAttributes : [];
        const hasGiftWrapAttr = customAttrs.some(
          (attr: {key?: string; value?: string}) =>
            attr.key === "Gift wrap" && String(attr.value).toLowerCase() === "yes",
        );
        const giftWrapStyleAttr = customAttrs.find(
          (attr: {key?: string; value?: string}) =>
            (attr.key === "Gift wrap style" || attr.key === "Gift style" || attr.key === "Gift wrap option") && attr.value,
        )?.value;

        const lineItems = order.lineItems?.nodes || [];
        const giftWrapLineItem = lineItems.find(
          (item: {title?: string; name?: string}) =>
            (item.title || "").toLowerCase().includes("gift wrap") ||
            (item.name || "").toLowerCase().includes("gift wrap"),
        );

        if (hasGiftWrapAttr || giftWrapLineItem) {
          const unitPrice = parseFloat(
            giftWrapLineItem?.originalUnitPriceSet?.shopMoney?.amount || "5.0",
          ) || 5.0;
          const qty = giftWrapLineItem?.quantity || 1;
          const itemPrice = unitPrice * qty;

          const variantDetail =
            giftWrapLineItem?.variantTitle && giftWrapLineItem.variantTitle !== "Default Title"
              ? giftWrapLineItem.variantTitle
              : giftWrapLineItem?.variant?.title && giftWrapLineItem.variant.title !== "Default Title"
              ? giftWrapLineItem.variant.title
              : (giftWrapLineItem?.name && giftWrapLineItem.name.includes(" - "))
              ? giftWrapLineItem.name.split(" - ").slice(1).join(" - ").trim()
              : giftWrapStyleAttr || null;

          const exactGiftTitle = variantDetail
            ? `Gift Wrap: ${variantDetail}`
            : (giftWrapLineItem?.name || giftWrapLineItem?.title || "Gift Wrap: Standard");

          const existingGiftWrap = await prisma.earningsLog.findFirst({
            where: {shop, orderId, featureType: "GIFT_WRAP"},
          });

          if (!existingGiftWrap) {
            await prisma.earningsLog.create({
              data: {
                shop,
                orderId,
                orderNumber,
                customerId,
                customerEmail,
                featureType: "GIFT_WRAP",
                itemTitle: exactGiftTitle,
                variantId: giftWrapLineItem?.variant?.id || null,
                quantity: qty,
                amount: itemPrice,
                currency,
                status: orderFinancialStatus,
              },
            });
            syncedCount++;
          } else if (existingGiftWrap.itemTitle !== exactGiftTitle && !exactGiftTitle.includes("Option")) {
            await prisma.earningsLog.update({
              where: {id: existingGiftWrap.id},
              data: {
                itemTitle: exactGiftTitle,
                variantId: giftWrapLineItem?.variant?.id || existingGiftWrap.variantId,
                amount: itemPrice || existingGiftWrap.amount,
                status: orderFinancialStatus,
              },
            });
          }
        }

        // 3. Sync Checkout Upsell items
        for (const item of lineItems) {
          const itemAttrs = Array.isArray(item.customAttributes) ? item.customAttributes : [];
          const isCheckoutUpsell = itemAttrs.some(
            (attr: {key?: string; value?: string}) =>
              attr.key === "_upsell_source" && attr.value === "checkout_upsell",
          );

          if (isCheckoutUpsell) {
            const unitPrice = parseFloat(
              item.originalUnitPriceSet?.shopMoney?.amount || "0.0",
            ) || 0.0;
            const qty = item.quantity || 1;
            const itemPrice = unitPrice * qty;

            const existingCheckoutUpsell = await prisma.earningsLog.findFirst({
              where: {
                shop,
                orderId,
                featureType: "CHECKOUT_UPSELL",
                itemTitle: item.title || "Checkout Upsell Item",
              },
            });

            if (!existingCheckoutUpsell) {
              await prisma.earningsLog.create({
                data: {
                  shop,
                  orderId,
                  orderNumber,
                  customerId,
                  customerEmail,
                  featureType: "CHECKOUT_UPSELL",
                  itemTitle: item.title || "Checkout Upsell Item",
                  variantId: item.variant?.id || null,
                  quantity: qty,
                  amount: itemPrice,
                  currency,
                  status: orderFinancialStatus,
                },
              });
              syncedCount++;
            }
          }
        }
      }

      return {success: true, syncedCount, message: `Synced ${syncedCount} new order(s).`};
    } catch (syncErr: any) {
      console.error("Manual order sync error in Money Made action:", syncErr);
      return {success: false, syncedCount: 0, message: syncErr?.message || "Sync failed"};
    }
  }

  return null;
};

export const loader = async ({request}: LoaderFunctionArgs) => {
  const {session} = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  const selectedFeature = url.searchParams.get("feature") || "ALL";
  const selectedDate = url.searchParams.get("date") || "ALL";
  const startDate = url.searchParams.get("startDate") || "";
  const endDate = url.searchParams.get("endDate") || "";
  const searchQuery = (url.searchParams.get("search") || "").trim();
  const requestedPage = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const PAGE_SIZE = 10;

  // Filter out cancelled orders for revenue statistics
  const activeWhere = {shop, status: {not: "CANCELLED"}};

  // 1. Fetch aggregate earnings by feature type
  const totals = await prisma.earningsLog.groupBy({
    by: ['featureType'],
    where: activeWhere,
    _sum: {
      amount: true,
    },
  });

  let oneClickRevenue = 0;
  let checkoutUpsellRevenue = 0;
  let discountRevenue = 0;
  let giftWrapRevenue = 0;

  totals.forEach((group) => {
    const sum = group._sum.amount || 0;
    if (group.featureType === "ONE_CLICK_UPSELL") oneClickRevenue = sum;
    if (group.featureType === "CHECKOUT_UPSELL") checkoutUpsellRevenue = sum;
    if (group.featureType === "DISCOUNT_CODE") discountRevenue = sum;
    if (group.featureType === "GIFT_WRAP") giftWrapRevenue = sum;
  });

  const totalRevenueResult = await prisma.earningsLog.aggregate({
    where: activeWhere,
    _sum: {
      amount: true,
    },
  });
  const totalRevenueAdded = totalRevenueResult._sum.amount || (oneClickRevenue + checkoutUpsellRevenue + discountRevenue + giftWrapRevenue);

  // Compute date filter boundary
  const now = new Date();
  let dateFilter: { gte?: Date; lte?: Date } | null = null;

  if (selectedDate === "TODAY") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    dateFilter = { gte: start };
  } else if (selectedDate === "YESTERDAY") {
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);
    dateFilter = { gte: start, lte: end };
  } else if (selectedDate === "LAST_7_DAYS") {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    dateFilter = { gte: start };
  } else if (selectedDate === "LAST_30_DAYS") {
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
    dateFilter = { gte: start };
  } else if (selectedDate === "LAST_90_DAYS") {
    const start = new Date(now);
    start.setDate(start.getDate() - 90);
    start.setHours(0, 0, 0, 0);
    dateFilter = { gte: start };
  } else if (selectedDate === "CUSTOM" && (startDate || endDate)) {
    const filterObj: { gte?: Date; lte?: Date } = {};
    if (startDate) {
      const s = new Date(startDate);
      s.setHours(0, 0, 0, 0);
      filterObj.gte = s;
    }
    if (endDate) {
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      filterObj.lte = e;
    }
    if (filterObj.gte || filterObj.lte) {
      dateFilter = filterObj;
    }
  }

  // 2. Fetch feature counts for dropdown options (scoped to date & search if present)
  const featureCountWhere: any = { shop };
  if (dateFilter) {
    featureCountWhere.createdAt = dateFilter;
  }
  if (searchQuery) {
    featureCountWhere.OR = [
      { orderNumber: { contains: searchQuery } },
      { itemTitle: { contains: searchQuery } },
      { customerEmail: { contains: searchQuery } },
    ];
  }

  const [
    allCount,
    oneClickCount,
    checkoutUpsellCount,
    giftWrapCount,
    discountCount
  ] = await Promise.all([
    prisma.earningsLog.count({ where: featureCountWhere }),
    prisma.earningsLog.count({ where: { ...featureCountWhere, featureType: "ONE_CLICK_UPSELL" } }),
    prisma.earningsLog.count({ where: { ...featureCountWhere, featureType: "CHECKOUT_UPSELL" } }),
    prisma.earningsLog.count({ where: { ...featureCountWhere, featureType: "GIFT_WRAP" } }),
    prisma.earningsLog.count({ where: { ...featureCountWhere, featureType: "DISCOUNT_CODE" } }),
  ]);

  // 3. Build filtered where clause for conversion activity table
  const tableWhere: any = { shop };
  if (selectedFeature && selectedFeature !== "ALL") {
    tableWhere.featureType = selectedFeature;
  }
  if (dateFilter) {
    tableWhere.createdAt = dateFilter;
  }
  if (searchQuery) {
    tableWhere.OR = [
      { orderNumber: { contains: searchQuery } },
      { itemTitle: { contains: searchQuery } },
      { customerEmail: { contains: searchQuery } },
    ];
  }

  const filteredCount = await prisma.earningsLog.count({
    where: tableWhere,
  });

  const totalPages = Math.ceil(filteredCount / PAGE_SIZE) || 1;
  const page = Math.min(requestedPage, totalPages);

  // 4. Fetch server-paginated conversions matching active filters
  const conversions = await prisma.earningsLog.findMany({
    where: tableWhere,
    orderBy: {createdAt: "desc"},
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return {
    shop,
    page,
    totalPages,
    totalConversionsCount: filteredCount,
    allCount,
    oneClickCount,
    checkoutUpsellCount,
    giftWrapCount,
    discountCount,
    selectedFeature,
    selectedDate,
    startDate,
    endDate,
    searchQuery,
    totalRevenueAdded,
    oneClickRevenue,
    checkoutUpsellRevenue,
    discountRevenue,
    giftWrapRevenue,
    conversions: conversions.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    })),
  };
};

export default function MoneyMadePage() {
  const {
    totalRevenueAdded,
    oneClickRevenue,
    checkoutUpsellRevenue,
    discountRevenue,
    giftWrapRevenue,
    conversions,
    page,
    totalPages,
    totalConversionsCount,
    allCount,
    oneClickCount,
    checkoutUpsellCount,
    giftWrapCount,
    discountCount,
    selectedFeature,
    selectedDate,
    startDate,
    endDate,
    searchQuery,
  } = useLoaderData<typeof loader>();

  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchQuery || "");
  const [customStartDate, setCustomStartDate] = useState(startDate || "");
  const [customEndDate, setCustomEndDate] = useState(endDate || "");

  useEffect(() => {
    setSearchInput(searchQuery || "");
  }, [searchQuery]);

  useEffect(() => {
    setCustomStartDate(startDate || "");
  }, [startDate]);

  useEffect(() => {
    setCustomEndDate(endDate || "");
  }, [endDate]);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(newPage));
    setSearchParams(params, { preventScrollReset: true });
  };

  const handleFeatureFilter = (feature: string) => {
    const params = new URLSearchParams(searchParams);
    if (feature && feature !== "ALL") {
      params.set("feature", feature);
    } else {
      params.delete("feature");
    }
    params.set("page", "1");
    setSearchParams(params, { preventScrollReset: true });
  };

  const handleDateFilter = (newDateRange: string) => {
    const params = new URLSearchParams(searchParams);
    if (newDateRange && newDateRange !== "ALL") {
      params.set("date", newDateRange);
    } else {
      params.delete("date");
      params.delete("startDate");
      params.delete("endDate");
    }
    if (newDateRange !== "CUSTOM") {
      params.delete("startDate");
      params.delete("endDate");
    }
    params.set("page", "1");
    setSearchParams(params, { preventScrollReset: true });
  };

  const handleApplyCustomDates = () => {
    const params = new URLSearchParams(searchParams);
    params.set("date", "CUSTOM");
    if (customStartDate) {
      params.set("startDate", customStartDate);
    } else {
      params.delete("startDate");
    }
    if (customEndDate) {
      params.set("endDate", customEndDate);
    } else {
      params.delete("endDate");
    }
    params.set("page", "1");
    setSearchParams(params, { preventScrollReset: true });
  };

  const handleApplySearch = (val?: string) => {
    const query = (val !== undefined ? val : searchInput).trim();
    const params = new URLSearchParams(searchParams);
    if (query) {
      params.set("search", query);
    } else {
      params.delete("search");
    }
    params.set("page", "1");
    setSearchParams(params, { preventScrollReset: true });
  };

  const handleClearSearch = () => {
    setSearchInput("");
    const params = new URLSearchParams(searchParams);
    params.delete("search");
    params.set("page", "1");
    setSearchParams(params, { preventScrollReset: true });
  };

  const handleResetAllFilters = () => {
    setSearchInput("");
    setCustomStartDate("");
    setCustomEndDate("");
    const params = new URLSearchParams(searchParams);
    params.delete("feature");
    params.delete("date");
    params.delete("startDate");
    params.delete("endDate");
    params.delete("search");
    params.set("page", "1");
    setSearchParams(params, { preventScrollReset: true });
  };

  
  const fetcher = useFetcher<{success?: boolean; syncedCount?: number; message?: string}>();
  const isSyncing = fetcher.state !== "idle";

  const totalRevenue = totalRevenueAdded > 0 ? totalRevenueAdded : 1;

  const formatPct = (amount: number) => {
    if (!amount || totalRevenue <= 0) return "0%";
    const raw = (amount / totalRevenue) * 100;
    if (raw > 0 && raw < 1) return "<1%";
    return `${Math.min(100, Math.round(raw))}%`;
  };

  const getBarWidth = (amount: number) => {
    if (!amount || totalRevenue <= 0) return "0%";
    const raw = (amount / totalRevenue) * 100;
    if (raw > 0 && raw < 1) return "1.5%";
    return `${Math.min(100, Math.round(raw))}%`;
  };

  return (
    <s-page heading="Money Made">
      <div style={{display: "flex", flexDirection: "column", gap: "24px", paddingBottom: "32px"}}>
        {fetcher.data?.message && (
          <s-banner tone={fetcher.data.success ? "success" : "critical"}>
            {fetcher.data.message}
          </s-banner>
        )}

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
              <div style={{fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8", fontWeight: 650}}>
                Total Additional Revenue Generated (Live)
              </div>
              <div style={{fontSize: "36px", fontWeight: 800, margin: "4px 0", color: "#38bdf8"}}>
                ${totalRevenueAdded.toFixed(2)}
              </div>
              <div style={{fontSize: "14px", color: "#cbd5e1"}}>
                Generated through 1-Click zero-shipping upsells, checkout upsells, thank-you discounts, and Gift Wrap Add-ons.
              </div>
            </div>

            <div style={{display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap"}}>
              <div style={{background: "rgba(255, 255, 255, 0.08)", padding: "12px 18px", borderRadius: "10px", minWidth: "140px"}}>
                <div style={{fontSize: "12px", color: "#94a3b8", textTransform: "uppercase", fontWeight: 600}}>
                  Total Conversions
                </div>
                <div style={{fontSize: "20px", fontWeight: 700, color: "#4ade80", marginTop: "2px"}}>
                  {totalConversionsCount}
                </div>
              </div>

              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="sync_orders" />
                <button
                  type="submit"
                  disabled={isSyncing}
                  style={{
                    background: isSyncing ? "rgba(255, 255, 255, 0.1)" : "rgba(56, 189, 248, 0.15)",
                    border: "1px solid rgba(56, 189, 248, 0.4)",
                    color: "#38bdf8",
                    padding: "10px 16px",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: isSyncing ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "all 0.2s ease",
                  }}
                >
                  {isSyncing ? "Syncing…" : "🔄 Sync Orders"}
                </button>
              </fetcher.Form>
            </div>
          </div>
        </div>



        {/* Feature Revenue Breakdown */}
        <s-section heading="Revenue Breakdown by Feature">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="base">
              <div>
                <div style={{display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "14px", fontWeight: 600}}>
                  <span>📦 1-Click Zero-Shipping Upsell</span>
                  <span>${oneClickRevenue.toFixed(2)} ({formatPct(oneClickRevenue)})</span>
                </div>
                <div style={{background: "#e2e8f0", height: "10px", borderRadius: "5px", overflow: "hidden"}}>
                  <div style={{background: "#0284c7", width: getBarWidth(oneClickRevenue), height: "100%"}} />
                </div>
              </div>

              <div>
                <div style={{display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "14px", fontWeight: 600}}>
                  <span>🛒 Pre-Purchase Checkout Upsell</span>
                  <span>${checkoutUpsellRevenue.toFixed(2)} ({formatPct(checkoutUpsellRevenue)})</span>
                </div>
                <div style={{background: "#e2e8f0", height: "10px", borderRadius: "5px", overflow: "hidden"}}>
                  <div style={{background: "#f59e0b", width: getBarWidth(checkoutUpsellRevenue), height: "100%"}} />
                </div>
              </div>

              <div>
                <div style={{display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "14px", fontWeight: 600}}>
                  <span>🏷️ Returning Customer Purchases (Discount Codes)</span>
                  <span>${discountRevenue.toFixed(2)} ({formatPct(discountRevenue)})</span>
                </div>
                <div style={{background: "#e2e8f0", height: "10px", borderRadius: "5px", overflow: "hidden"}}>
                  <div style={{background: "#16a34a", width: getBarWidth(discountRevenue), height: "100%"}} />
                </div>
              </div>

              <div>
                <div style={{display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "14px", fontWeight: 600}}>
                  <span>🎁 Gift Wrap Add-ons</span>
                  <span>${giftWrapRevenue.toFixed(2)} ({formatPct(giftWrapRevenue)})</span>
                </div>
                <div style={{background: "#e2e8f0", height: "10px", borderRadius: "5px", overflow: "hidden"}}>
                  <div style={{background: "#9333ea", width: getBarWidth(giftWrapRevenue), height: "100%"}} />
                </div>
              </div>
            </s-stack>
          </s-box>
        </s-section>

        {/* Conversion Activity Table */}
        <s-section heading="Conversion Activity">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            {/* Filter Toolbar */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                marginBottom: "16px",
                paddingBottom: "14px",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              {/* Dropdown Filters (Feature + Date) */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                {/* Feature Dropdown Filter */}
                <div style={{display: "flex", alignItems: "center", gap: "6px"}}>
                  <label htmlFor="feature-filter" style={{fontSize: "13px", fontWeight: 600, color: "#374151"}}>
                    Feature:
                  </label>
                  <select
                    id="feature-filter"
                    value={selectedFeature}
                    onChange={(e) => handleFeatureFilter(e.target.value)}
                    style={{
                      padding: "7px 12px",
                      borderRadius: "8px",
                      border: selectedFeature !== "ALL" ? "1.5px solid #008060" : "1px solid #d1d5db",
                      background: selectedFeature !== "ALL" ? "#f0fdf4" : "#ffffff",
                      color: selectedFeature !== "ALL" ? "#047857" : "#374151",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: "pointer",
                      outline: "none",
                    }}
                  >
                    <option value="ALL">All Features ({allCount})</option>
                    <option value="ONE_CLICK_UPSELL">📦 1-Click Upsell ({oneClickCount})</option>
                    <option value="CHECKOUT_UPSELL">🛒 Checkout Upsell ({checkoutUpsellCount})</option>
                    <option value="GIFT_WRAP">🎁 Gift Options ({giftWrapCount})</option>
                    <option value="DISCOUNT_CODE">🏷️ Thank You Discount ({discountCount})</option>
                  </select>
                </div>

                {/* Date Dropdown Filter */}
                <div style={{display: "flex", alignItems: "center", gap: "6px"}}>
                  <label htmlFor="date-filter" style={{fontSize: "13px", fontWeight: 600, color: "#374151"}}>
                    Date:
                  </label>
                  <select
                    id="date-filter"
                    value={selectedDate}
                    onChange={(e) => handleDateFilter(e.target.value)}
                    style={{
                      padding: "7px 12px",
                      borderRadius: "8px",
                      border: selectedDate !== "ALL" ? "1.5px solid #008060" : "1px solid #d1d5db",
                      background: selectedDate !== "ALL" ? "#f0fdf4" : "#ffffff",
                      color: selectedDate !== "ALL" ? "#047857" : "#374151",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: "pointer",
                      outline: "none",
                    }}
                  >
                    <option value="ALL">All Time</option>
                    <option value="TODAY">Today</option>
                    <option value="YESTERDAY">Yesterday</option>
                    <option value="LAST_7_DAYS">Last 7 Days</option>
                    <option value="LAST_30_DAYS">Last 30 Days</option>
                    <option value="LAST_90_DAYS">Last 90 Days</option>
                    <option value="CUSTOM">Custom Range...</option>
                  </select>
                </div>

                {/* Reset button if any filter is active */}
                {(selectedFeature !== "ALL" || selectedDate !== "ALL" || searchQuery) && (
                  <button
                    type="button"
                    onClick={handleResetAllFilters}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                      background: "#ffffff",
                      color: "#dc2626",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    title="Reset all active filters"
                  >
                    Reset Filters
                  </button>
                )}
              </div>

              {/* Search Bar */}
              <div
                style={{
                  position: "relative",
                  minWidth: "240px",
                  maxWidth: "340px",
                  flexGrow: 1,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    left: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#9ca3af",
                    fontSize: "13px",
                    pointerEvents: "none",
                  }}
                >
                  🔍
                </span>
                <input
                  type="text"
                  placeholder="Search order #, item, or email..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleApplySearch();
                  }}
                  style={{
                    width: "100%",
                    padding: "7px 30px 7px 30px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    fontSize: "13px",
                    outline: "none",
                    background: "#ffffff",
                    boxSizing: "border-box",
                  }}
                />
                {searchInput ? (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    style={{
                      position: "absolute",
                      right: "8px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "#9ca3af",
                      cursor: "pointer",
                      fontSize: "14px",
                      padding: "2px",
                      lineHeight: 1,
                    }}
                    title="Clear search"
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            </div>

            {/* Custom Date Range Picker (shown when CUSTOM is selected) */}
            {selectedDate === "CUSTOM" && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "14px",
                  padding: "10px 14px",
                  background: "#f9fafb",
                  borderRadius: "8px",
                  border: "1px solid #e5e7eb",
                }}
              >
                <span style={{fontSize: "13px", fontWeight: 600, color: "#374151"}}>
                  Custom Date Range:
                </span>
                <div style={{display: "flex", alignItems: "center", gap: "6px"}}>
                  <label htmlFor="custom-start-date" style={{fontSize: "12px", color: "#6b7280"}}>From:</label>
                  <input
                    id="custom-start-date"
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    style={{
                      padding: "5px 8px",
                      borderRadius: "6px",
                      border: "1px solid #d1d5db",
                      fontSize: "12px",
                      background: "#ffffff",
                    }}
                  />
                </div>
                <div style={{display: "flex", alignItems: "center", gap: "6px"}}>
                  <label htmlFor="custom-end-date" style={{fontSize: "12px", color: "#6b7280"}}>To:</label>
                  <input
                    id="custom-end-date"
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    style={{
                      padding: "5px 8px",
                      borderRadius: "6px",
                      border: "1px solid #d1d5db",
                      fontSize: "12px",
                      background: "#ffffff",
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleApplyCustomDates}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "none",
                    background: "#008060",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Apply Dates
                </button>
              </div>
            )}

            {/* Active filter summary pill bar (when filtered) */}
            {(selectedFeature !== "ALL" || selectedDate !== "ALL" || searchQuery) && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  background: "#f9fafb",
                  borderRadius: "6px",
                  marginBottom: "14px",
                  fontSize: "12px",
                  color: "#4b5563",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                <div style={{display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap"}}>
                  <span>Filtered by:</span>
                  {selectedFeature !== "ALL" && (
                    <span style={{background: "#e0f2fe", color: "#0369a1", padding: "2px 8px", borderRadius: "12px", fontWeight: 600}}>
                      {featureLabel(selectedFeature)}
                    </span>
                  )}
                  {selectedDate !== "ALL" && (
                    <span style={{background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: "12px", fontWeight: 600}}>
                      📅 {dateRangeLabel(selectedDate, startDate, endDate)}
                    </span>
                  )}
                  {searchQuery && (
                    <span style={{background: "#f3f4f6", color: "#374151", padding: "2px 8px", borderRadius: "12px", fontWeight: 600}}>
                      🔍 "{searchQuery}"
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleResetAllFilters}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#008060",
                    fontWeight: 600,
                    cursor: "pointer",
                    textDecoration: "underline",
                    fontSize: "12px",
                    padding: 0,
                  }}
                >
                  Reset filters
                </button>
              </div>
            )}

            {conversions.length ? (
              <div>
                <s-table>
                  <s-table-header-row>
                    <s-table-header listSlot="primary">Order</s-table-header>
                    <s-table-header>Feature</s-table-header>
                    <s-table-header>Item Added</s-table-header>
                    <s-table-header format="numeric">Revenue Added</s-table-header>
                    <s-table-header>Date</s-table-header>
                  </s-table-header-row>
                  <s-table-body>
                    {conversions.map((conv) => (
                      <s-table-row key={conv.id}>
                        <s-table-cell>{conv.orderNumber || shortGid(conv.orderId)}</s-table-cell>
                        <s-table-cell>{featureLabel(conv.featureType)}</s-table-cell>
                        <s-table-cell>{conv.itemTitle}</s-table-cell>
                        <s-table-cell>${(conv.amount || 0).toFixed(2)}</s-table-cell>
                        <s-table-cell>{formatDate(conv.createdAt)}</s-table-cell>
                      </s-table-row>
                    ))}
                  </s-table-body>
                </s-table>

                {/* On-demand server pagination controls */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    borderTop: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    borderRadius: "0 0 8px 8px",
                  }}
                >
                  <s-text color="subdued">
                    Showing {Math.min((page - 1) * 10 + 1, totalConversionsCount)}–
                    {Math.min(page * 10, totalConversionsCount)} of {totalConversionsCount} entries
                  </s-text>

                  <div style={{display: "flex", alignItems: "center", gap: "10px"}}>
                    <s-button
                      disabled={page <= 1}
                      onClick={() => handlePageChange(page - 1)}
                    >
                      &lt;
                    </s-button>

                    <s-text type="strong">
                      Page {page} of {totalPages}
                    </s-text>

                    <s-button
                      disabled={page >= totalPages}
                      onClick={() => handlePageChange(page + 1)}
                    >
                      &gt;
                    </s-button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{textAlign: "center", padding: "36px 16px"}}>
                {selectedFeature !== "ALL" || selectedDate !== "ALL" || searchQuery ? (
                  <>
                    <div style={{fontSize: "32px", marginBottom: "8px"}}>🔍</div>
                    <div style={{fontSize: "15px", fontWeight: 600, color: "#111827", marginBottom: "4px"}}>
                      No matching conversions found
                    </div>
                    <p style={{fontSize: "13px", color: "#6b7280", margin: "0 0 16px 0"}}>
                      No records matched your current filter criteria.
                    </p>
                    <button
                      type="button"
                      onClick={handleResetAllFilters}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "6px",
                        border: "1px solid #d1d5db",
                        background: "#ffffff",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: 500,
                      }}
                    >
                      Clear all filters
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{fontSize: "36px", marginBottom: "8px"}}>🛍️</div>
                    <div style={{fontSize: "16px", fontWeight: 600, marginBottom: "4px"}}>
                      No conversions recorded yet
                    </div>
                    <s-text color="subdued">
                      When customers accept 1-click upsells, checkout upsells, redeem thank-you discounts, or add gift wrap at checkout, their orders and added revenue will appear here automatically.
                    </s-text>
                  </>
                )}
              </div>
            )}
          </s-box>
        </s-section>


      </div>
    </s-page>
  );
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function shortGid(value?: string | null) {
  if (!value) return "-";
  const parts = value.split("/");
  return `#${parts[parts.length - 1]}`;
}

function featureLabel(type: string) {
  if (type === "ONE_CLICK_UPSELL") return "📦 1-Click Upsell";
  if (type === "CHECKOUT_UPSELL") return "🛒 Checkout Upsell";
  if (type === "DISCOUNT_CODE") return "🏷️ Thank You Discount";
  if (type === "GIFT_WRAP") return "🎁 Gift Options";
  return type;
}

function dateRangeLabel(range: string, start?: string, end?: string) {
  if (range === "TODAY") return "Today";
  if (range === "YESTERDAY") return "Yesterday";
  if (range === "LAST_7_DAYS") return "Last 7 Days";
  if (range === "LAST_30_DAYS") return "Last 30 Days";
  if (range === "LAST_90_DAYS") return "Last 90 Days";
  if (range === "CUSTOM") {
    if (start && end) return `${start} to ${end}`;
    if (start) return `From ${start}`;
    if (end) return `Until ${end}`;
    return "Custom Range";
  }
  return "All Time";
}
