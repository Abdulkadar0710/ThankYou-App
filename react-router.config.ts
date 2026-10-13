import type { Config } from "@react-router/dev/config";

const appUrl = process.env.SHOPIFY_APP_URL || process.env.PUBLIC_APP_URL || "";
let appHost: string | undefined;
try {
  if (appUrl) {
    appHost = new URL(appUrl).host;
  }
} catch {
  // Ignore invalid URL
}

export default {
  // Server-side action CSRF protection allowed origins
  // Required in React Router v7 when running behind reverse proxies (e.g. Railway, Cloudflare, tunnels)
  allowedActionOrigins: [
    ...(appHost ? [appHost] : []),
    "*.up.railway.app",
    "*.railway.app",
    "*.myshopify.com",
    "admin.shopify.com",
    "*.trycloudflare.com",
    "*.ngrok.io",
    "*.ngrok-free.app",
    "*.ngrok-free.dev",
    "localhost:*",
    "localhost",
  ],
} satisfies Config;
