import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const SHOPIFY_APP_URL =
  process.env.SHOPIFY_APP_URL ||
  process.env.PUBLIC_APP_URL ||
  process.env.HOST ||
  "";

const SCOPES =
  process.env.SCOPES ||
  "read_customers,write_customers,read_orders,read_products,write_discounts,write_metaobject_definitions,write_metaobjects,write_products,read_shipping";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: SCOPES.split(","),
  appUrl: SHOPIFY_APP_URL,
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma) as never,
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;

// Wrapper around shopify.authenticate.admin that logs when no session.shop is present.
export async function authenticateAdmin(request: Request) {
  try {
    const result = await (shopify.authenticate as any).admin(request);

    if (!result || !result.session || !result.session.shop) {
      try {
        const headers = Object.fromEntries(Array.from(request.headers || []));
        console.error("AUTH WARNING: authenticate.admin returned no session.shop", {
          url: request.url?.toString?.() ?? "<unknown>",
          headers,
        });
      } catch (err) {
        console.error("AUTH WARNING: failed to log request headers", err);
      }
    }

    return result;
  } catch (err) {
    console.error("AUTH ERROR: authenticate.admin threw error", err);
    throw err;
  }
}
