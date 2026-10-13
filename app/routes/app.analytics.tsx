import type {LoaderFunctionArgs} from "react-router";
import {useLoaderData} from "react-router";
import prisma from "../db.server";
import {authenticate} from "../shopify.server";

export const loader = async ({request}: LoaderFunctionArgs) => {
  const {session} = await authenticate.admin(request);
  const shop = session.shop;
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  const allClicks = await prisma.subscriptionClick.findMany({
      where: {shop},
      orderBy: {createdAt: "desc"},
    });
  const countsByType = Object.entries(
    allClicks.reduce<Record<string, number>>(
      (counts, click) => {
        const eventType =
          click.eventType || "subscription_click";

        counts[eventType] =
          (counts[eventType] || 0) + 1;

        return counts;
      },
      {},
    ),
  )
    .map(([eventType, count]) => ({
      eventType,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalClicks: allClicks.length,
    todayClicks: allClicks.filter(
      (click) => click.createdAt >= today,
    ).length,
    countsByType,
    clicks: allClicks.slice(0, 50).map((click) => ({
      ...click,
      createdAt: click.createdAt.toISOString(),
    })),
  };
};

export default function AnalyticsPage() {
  const {clicks, totalClicks, todayClicks, countsByType} =
    useLoaderData<typeof loader>();

  return (
    <s-page heading="Analytics">
      <s-section heading="Thank-you page clicks">
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
        </s-stack>
      </s-section>

      <s-section heading="Clicks by type">
        {countsByType.length ? (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Click type</s-table-header>
              <s-table-header format="numeric">Clicks</s-table-header>
            </s-table-header-row>

            <s-table-body>
              {countsByType.map((item) => (
                <s-table-row key={item.eventType}>
                  <s-table-cell>
                    {eventLabel(item.eventType)}
                  </s-table-cell>
                  <s-table-cell>{item.count}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        ) : (
          <s-paragraph>
            No clicks have been tracked yet.
          </s-paragraph>
        )}
      </s-section>

      <s-section heading="Recent clicks">
        {clicks.length ? (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Date</s-table-header>
              <s-table-header>Type</s-table-header>
              {/* <s-table-header>Order</s-table-header>
              <s-table-header>Item</s-table-header> */}
              <s-table-header>Details</s-table-header>
              <s-table-header>Link</s-table-header>
            </s-table-header-row>

            <s-table-body>
              {clicks.map((click) => (
                <s-table-row key={click.id}>
                  <s-table-cell>
                    {formatDate(click.createdAt)}
                  </s-table-cell>
                  <s-table-cell>
                    {eventLabel(click.eventType)}
                  </s-table-cell>
                  {/* <s-table-cell>
                    {click.orderNumber ||
                      shortId(click.orderId) ||
                      "-"}
                  </s-table-cell>
                  <s-table-cell>
                    {click.itemTitle ||
                      click.ctaText ||
                      "-"}
                  </s-table-cell> */}
                  <s-table-cell>
                    {click.itemId || click.itemTitle || click.ctaText || "-"}
                  </s-table-cell>
                  <s-table-cell>
                    {click.itemUrl || click.ctaLink ? (
                      <s-link
                        href={
                          click.itemUrl ||
                          click.ctaLink ||
                          ""
                        }
                        target="_blank"
                      >
                        Open link
                      </s-link>
                    ) : (
                      "-"
                    )}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        ) : (
          <s-paragraph>
            No clicks have been tracked yet.
          </s-paragraph>
        )}
      </s-section>
    </s-page>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function shortId(value?: string | null) {
  return value?.split("/").at(-1);
}

function eventLabel(value?: string | null) {
  return (value || "subscription_click")
    .split("_")
    .map((word) =>
      word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}
