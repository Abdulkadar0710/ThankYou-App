import type {HeadersFunction, LoaderFunctionArgs} from "react-router";
import {useLoaderData} from "react-router";
import {authenticate} from "../shopify.server";
import {boundary} from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { createMetafieldDefinitions } from "../utils/metafields.server";
import {checkoutEditorUrl} from "../utils/checkoutEditor.server";

export const loader = async ({request}: LoaderFunctionArgs) => {
  // const {session} = await authenticate.admin(request);
  const {session, admin} = await authenticate.admin(request);
  await createMetafieldDefinitions(admin);
  const shop = session.shop;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [totalClicks, todayClicks, recentClicks, recentEventTypes] =
    await Promise.all([
      prisma.subscriptionClick.count({where: {shop}}),
      prisma.subscriptionClick.count({
        where: {
          shop,
          createdAt: {gte: today},
        },
      }),
      prisma.subscriptionClick.findMany({
        where: {shop},
        orderBy: {createdAt: "desc"},
        take: 5,
      }),
      prisma.subscriptionClick.findMany({
        where: {
          shop,
          createdAt: {gte: sevenDaysAgo},
        },
        select: {eventType: true},
      }),
    ]);

  const topEventType = Object.entries(
    recentEventTypes.reduce<Record<string, number>>((counts, click) => {
      const eventType = click.eventType || "subscription_click";

      counts[eventType] = (counts[eventType] || 0) + 1;

      return counts;
    }, {}),
  ).sort((a, b) => b[1] - a[1])[0];

  return {
    checkoutCustomizeUrl: await checkoutEditorUrl(shop, admin),
    totalClicks,
    todayClicks,
    recentCount: recentEventTypes.length,
    topEventType: topEventType
      ? {
          eventType: topEventType[0],
          count: topEventType[1],
        }
      : null,
    recentClicks: recentClicks.map((click) => ({
      id: click.id,
      eventType: click.eventType,
      itemTitle: click.itemTitle,
      ctaText: click.ctaText,
      createdAt: click.createdAt.toISOString(),
    })),
  };
};

export default function Index() {
  const {
    checkoutCustomizeUrl,
    totalClicks,
    todayClicks,
    recentCount,
    topEventType,
    recentClicks,
  } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Thank You Dynamic Solutions">
      <s-button slot="primary-action" href="/app/analytics">
        View analytics
      </s-button>

      <s-section heading="Performance snapshot">
        <s-stack direction="inline" gap="base">
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            minInlineSize="160px"
          >
            <s-stack gap="small-200">
              <s-text>Total clicks</s-text>
              <s-heading>{totalClicks}</s-heading>
            </s-stack>
          </s-box>

          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            minInlineSize="160px"
          >
            <s-stack gap="small-200">
              <s-text>Today</s-text>
              <s-heading>{todayClicks}</s-heading>
            </s-stack>
          </s-box>

          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            minInlineSize="160px"
          >
            <s-stack gap="small-200">
              <s-text>Last 7 days</s-text>
              <s-heading>{recentCount}</s-heading>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      <s-section heading="Dynamic thank-you blocks">
        <s-stack direction="block" gap="base">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="small">
              <s-heading>Upsell product recommendations</s-heading>
              <s-paragraph>
                Shows shoppers products related to their completed order and
                tracks each product click back to this dashboard.
              </s-paragraph>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="small">
              <s-heading>FAQ accordion</s-heading>
              <s-paragraph>
                Adds a compact accordion for common post-purchase questions on
                the thank-you page.
              </s-paragraph>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack gap="small">
              <s-heading>Image or video section</s-heading>
              <s-paragraph>
                Lets merchants choose a static image or a clickable video
                thumbnail from checkout customization.
              </s-paragraph>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      <s-section heading="Set up thank-you page blocks">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Add the blocks from this app in Shopify checkout settings,
            then place and customize them on the thank-you page.
          </s-paragraph>

          <s-stack direction="inline" gap="small">
            <s-button
              variant="primary"
              href="/app/blocks"
            >
              Manage app blocks
            </s-button>
            <s-button href={checkoutCustomizeUrl} target="_blank">
              Open editor
            </s-button>
          </s-stack>
        </s-stack>
      </s-section>

      <s-section heading="Recent activity">
        {recentClicks.length ? (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Date</s-table-header>
              <s-table-header>Event</s-table-header>
              <s-table-header>Clicked item</s-table-header>
            </s-table-header-row>

            <s-table-body>
              {recentClicks.map((click) => (
                <s-table-row key={click.id}>
                  <s-table-cell>{formatDate(click.createdAt)}</s-table-cell>
                  <s-table-cell>{eventLabel(click.eventType)}</s-table-cell>
                  <s-table-cell>
                    {click.itemTitle || click.ctaText || "-"}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        ) : (
          <s-paragraph>
            No checkout or thank-you page clicks have been tracked yet.
          </s-paragraph>
        )}
      </s-section>

      <s-section slot="aside" heading="Top signal">
        {topEventType ? (
          <s-stack gap="small-200">
            <s-text>{eventLabel(topEventType.eventType)}</s-text>
            <s-heading>{topEventType.count}</s-heading>
            <s-paragraph>Clicks in the last 7 days.</s-paragraph>
          </s-stack>
        ) : (
          <s-paragraph>
            Activity will appear here after shoppers interact with your
            checkout or thank-you page blocks.
          </s-paragraph>
        )}
      </s-section>

      {/* <s-section slot="aside" heading="Solution checklist">
        <s-unordered-list>
          <s-list-item>Recommend products after purchase</s-list-item>
          <s-list-item>Promote a subscription or repeat-purchase CTA</s-list-item>
          <s-list-item>Measure every thank-you page click</s-list-item>
        </s-unordered-list>
      </s-section> */}
    </s-page>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function eventLabel(value?: string | null) {
  return (value || "subscription_click")
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
