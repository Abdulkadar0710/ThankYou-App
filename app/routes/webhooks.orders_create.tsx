import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  if (!payload || !shop) {
    return new Response();
  }

  try {
    const orderId = payload.admin_graphql_api_id || `gid://shopify/Order/${payload.id}`;
    const orderNumber = payload.name || `#${payload.order_number}`;
    const customerId = payload.customer?.admin_graphql_api_id || (payload.customer?.id ? `gid://shopify/Customer/${payload.customer.id}` : null);
    const customerEmail = payload.email || payload.customer?.email || null;
    const orderPrice = parseFloat(payload.total_price || "0.0") || 0.0;
    const currency = payload.currency || "USD";
    const discountCodes = Array.isArray(payload.discount_codes)
      ? payload.discount_codes.map((d: {code: string}) => d.code).filter(Boolean)
      : [];

    let isRepeatCustomer = false;
    let initialOrderId = orderId;
    let returnDays: number | null = null;
    let redeemedCode: string | null = null;

    if (customerId) {
      const existingCustomer = await db.customerRetentionLog.findUnique({
        where: {
          shop_customerId: {
            shop,
            customerId,
          },
        },
      });

      if (existingCustomer) {
        isRepeatCustomer = true;
        initialOrderId = existingCustomer.initialOrderId;
        const diffMs = Date.now() - new Date(existingCustomer.initialOrderDate).getTime();
        returnDays = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

        await db.customerRetentionLog.update({
          where: { id: existingCustomer.id },
          data: {
            totalOrdersCount: { increment: 1 },
            totalLifetimeValue: { increment: orderPrice },
            lastPurchaseDate: new Date(),
          },
        });
      } else {
        await db.customerRetentionLog.create({
          data: {
            shop,
            customerId,
            customerEmail,
            initialOrderId: orderId,
            totalOrdersCount: 1,
            totalLifetimeValue: orderPrice,
          },
        });
      }
    }

    // Check discount code redemptions
    if (discountCodes.length) {
      redeemedCode = discountCodes[0];
      const matchingRetention = await db.customerRetentionLog.findFirst({
        where: {
          shop,
          discountCodeIssued: redeemedCode,
        },
      });

      if (matchingRetention) {
        await db.customerRetentionLog.update({
          where: { id: matchingRetention.id },
          data: {
            discountCodeRedeemed: true,
            redeemedOrderId: orderId,
          },
        });
      }

      const existingDiscount = await db.upsellConversion.findFirst({
        where: { shop, orderId, featureType: "DISCOUNT_CODE" },
      });

      if (!existingDiscount) {
        await db.upsellConversion.create({
          data: {
            shop,
            orderId,
            orderNumber,
            customerId,
            customerEmail,
            featureType: "DISCOUNT_CODE",
            itemTitle: `Discount Redeemed: ${redeemedCode}`,
            amount: orderPrice,
            currency,
            discountCode: redeemedCode,
            isRepeatPurchase: isRepeatCustomer,
            firstOrderId: initialOrderId,
            returnIntervalDays: returnDays,
            status: "COMPLETED",
          },
        });
      }
    }

    // Check Gift Wrap options (custom attributes or line items)
    const noteAttributes = Array.isArray(payload.note_attributes)
      ? payload.note_attributes
      : Array.isArray(payload.custom_attributes)
      ? payload.custom_attributes
      : [];

    const hasGiftWrapAttr = noteAttributes.some(
      (attr: {name?: string; key?: string; value?: string}) =>
        (attr.name === "Gift wrap" || attr.key === "Gift wrap") &&
        String(attr.value).toLowerCase() === "yes"
    );

    const giftWrapLineItem = (payload.line_items || []).find(
      (item: {title?: string; name?: string; price?: string}) =>
        (item.title || item.name || "").toLowerCase().includes("gift wrap")
    );

    if (hasGiftWrapAttr || giftWrapLineItem) {
      const giftWrapAmount = giftWrapLineItem
        ? parseFloat(giftWrapLineItem.price || "5.0") || 5.0
        : 5.0;

      const existingGiftWrap = await db.upsellConversion.findFirst({
        where: { shop, orderId, featureType: "GIFT_WRAP" },
      });

      if (!existingGiftWrap) {
        await db.upsellConversion.create({
          data: {
            shop,
            orderId,
            orderNumber,
            customerId,
            customerEmail,
            featureType: "GIFT_WRAP",
            itemTitle: giftWrapLineItem?.title || giftWrapLineItem?.name || "Gift Wrap Option",
            amount: giftWrapAmount,
            currency,
            status: "COMPLETED",
          },
        });
      }
    }
  } catch (error) {
    console.error("Error processing orders_create webhook:", error);
  }

  return new Response();
};
