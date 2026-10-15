import { useEffect } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
} from "react-router";

export default function App() {
  useEffect(() => {
    if (document.getElementById("tawk-to-script")) return;

    const win = window as unknown as {
      Tawk_API?: Record<string, unknown>;
      Tawk_LoadStart?: Date;
    };
    win.Tawk_API = win.Tawk_API || {};
    win.Tawk_LoadStart = new Date();

    const s1 = document.createElement("script");
    s1.id = "tawk-to-script";
    s1.async = true;
    s1.src = "https://embed.tawk.to/6ad08d5283745634c605f52f/1k4vag3mn";
    s1.charset = "UTF-8";
    s1.setAttribute("crossorigin", "*");

    const s0 = document.getElementsByTagName("script")[0];
    if (s0 && s0.parentNode) {
      s0.parentNode.insertBefore(s1, s0);
    } else {
      document.head.appendChild(s1);
    }
  }, []);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  let errorMessage = "An unexpected error occurred";
  let errorStatus = 500;

  if (isRouteErrorResponse(error)) {
    errorStatus = error.status;
    errorMessage = error.statusText || error.data?.message || String(error.data);
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Application Error</title>
        <Meta />
        <Links />
      </head>
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
        <h1>Application Error ({errorStatus})</h1>
        <p>{errorMessage}</p>
        <a href="/" style={{ color: "#008060", textDecoration: "underline" }}>
          Return to Home
        </a>
        <Scripts />
      </body>
    </html>
  );
}
