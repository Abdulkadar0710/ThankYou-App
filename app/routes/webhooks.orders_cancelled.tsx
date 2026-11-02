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

    // Mark any earnings log entries for this order as CANCELLED
    const result = await db.earningsLog.updateMany({
      where: {
        shop,
        orderId,
      },
      data: {
        status: "CANCELLED",
      },
    });

    console.log(`Marked ${result.count} conversions as CANCELLED for order ${orderId}`);
  } catch (error) {
    console.error("Error processing orders_cancelled webhook:", error);
  }

  return new Response();
};
