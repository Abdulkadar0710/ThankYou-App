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

    const financialStatus = payload.financial_status
      ? payload.financial_status.toUpperCase()
      : "PAID";
    const orderStatus = payload.cancelled_at ? "CANCELLED" : financialStatus;

    // Check discount code redemptions
    if (discountCodes.length) {
      const redeemedCode = discountCodes[0];
      const existingDiscount = await db.earningsLog.findFirst({
        where: { shop, orderId, featureType: "DISCOUNT_CODE" },
      });

      if (!existingDiscount) {
        await db.earningsLog.create({
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
            status: orderStatus,
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
      const unitPrice = giftWrapLineItem
        ? parseFloat(giftWrapLineItem.price || "5.0") || 5.0
        : 5.0;
      const qty = giftWrapLineItem?.quantity || 1;
      const giftWrapAmount = unitPrice * qty;

      const giftStyleAttr = noteAttributes.find(
        (attr: {name?: string; key?: string; value?: string}) =>
          (attr.name === "Gift wrap style" || attr.key === "Gift wrap style" || attr.name === "Gift style" || attr.key === "Gift style") && attr.value,
      )?.value;

      const variantDetail =
        giftWrapLineItem?.variant_title && giftWrapLineItem.variant_title !== "Default Title"
          ? giftWrapLineItem.variant_title
          : (giftWrapLineItem?.name && giftWrapLineItem.name.includes(" - "))
          ? giftWrapLineItem.name.split(" - ").slice(1).join(" - ").trim()
          : giftStyleAttr || null;

      const exactGiftTitle = variantDetail
        ? `Gift Wrap: ${variantDetail}`
        : (giftWrapLineItem?.name || giftWrapLineItem?.title || "Gift Wrap: Standard");

      const existingGiftWrap = await db.earningsLog.findFirst({
        where: { shop, orderId, featureType: "GIFT_WRAP" },
      });

      if (!existingGiftWrap) {
        await db.earningsLog.create({
          data: {
            shop,
            orderId,
            orderNumber,
            customerId,
            customerEmail,
            featureType: "GIFT_WRAP",
            itemTitle: exactGiftTitle,
            variantId: giftWrapLineItem?.variant_id ? `gid://shopify/ProductVariant/${giftWrapLineItem.variant_id}` : null,
            quantity: qty,
            amount: giftWrapAmount,
            currency,
            status: orderStatus,
          },
        });
      } else if (existingGiftWrap.itemTitle !== exactGiftTitle && !exactGiftTitle.includes("Option")) {
        await db.earningsLog.update({
          where: { id: existingGiftWrap.id },
          data: {
            itemTitle: exactGiftTitle,
            variantId: giftWrapLineItem?.variant_id ? `gid://shopify/ProductVariant/${giftWrapLineItem.variant_id}` : existingGiftWrap.variantId,
            amount: giftWrapAmount || existingGiftWrap.amount,
            status: orderStatus,
          },
        });
      }
    }

    // Check Pre-Purchase Checkout Upsell line items
    const lineItems = Array.isArray(payload.line_items) ? payload.line_items : [];
    for (const item of lineItems) {
      const properties = Array.isArray(item.properties)
        ? item.properties
        : Array.isArray(item.custom_attributes)
        ? item.custom_attributes
        : [];

      const isCheckoutUpsell = properties.some(
        (prop: {name?: string; key?: string; value?: string}) =>
          (prop.name === "_upsell_source" || prop.key === "_upsell_source") &&
          prop.value === "checkout_upsell"
      );

      if (isCheckoutUpsell) {
        const itemPrice = parseFloat(item.price || "0.0") || 0.0;
        const qty = item.quantity || 1;
        const totalItemAmount = itemPrice * qty;
        const itemVariantId = item.variant_id
          ? `gid://shopify/ProductVariant/${item.variant_id}`
          : null;

        const existingUpsell = await db.earningsLog.findFirst({
          where: {
            shop,
            orderId,
            featureType: "CHECKOUT_UPSELL",
            itemTitle: item.title || item.name || "Checkout Upsell Item",
          },
        });

        if (!existingUpsell) {
          await db.earningsLog.create({
            data: {
              shop,
              orderId,
              orderNumber,
              customerId,
              customerEmail,
              featureType: "CHECKOUT_UPSELL",
              itemTitle: item.title || item.name || "Checkout Upsell Item",
              variantId: itemVariantId,
              quantity: qty,
              amount: totalItemAmount,
              currency,
              status: orderStatus,
            },
          });
        }
      }
    }
  } catch (error) {
    console.error("Error processing orders_create webhook:", error);
  }

  return new Response();
};
