import '@shopify/ui-extensions/preact';
import {render} from "preact";
import {useEffect, useState} from "preact/hooks";
import {trackThankYouClick} from '../../shared/analytics';
import {limitText, trimText} from '../../shared/text';
import {fetchActiveBlock} from '../../shared/blocks';

export default () => {
  try {
    render(<Extension />, document.body);
  } catch (error) {
    console.error('Extension failed to render:', error);
    // Graceful fallback - render nothing rather than breaking page
  }
};

function Extension() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveBlock('promotion')
      .then((block) => {
        if (block?.config) {
          setConfig(block.config);
        } else {
          return fetchActiveBlock('loyalty').then((fallbackBlock) => {
            setConfig(fallbackBlock?.config || null);
          });
        }
      })
      .catch((error) => {
        console.error(error);
        setConfig(null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <s-stack gap="base">
        <s-box padding="base" border="base" borderRadius="base">
          <s-stack gap="base">
            <s-skeleton-paragraph />
            <s-skeleton-paragraph />
            <s-skeleton-paragraph />
            <s-skeleton-paragraph />
          </s-stack>
        </s-box>
      </s-stack>
    );
  }
  if (!config) return null;

  const promotionHeading = limitText(
    trimText(config.title) || 'Earn rewards on every order',
    48,
  );
  const loyaltyHeading = promotionHeading;

  const promotionText = parseRichText(
    replaceReferralVariables(
      config.description || "Join our loyalty program and start earning points today",
      config,
    ),
  );
  const loyaltyText = promotionText;

  const promotionCta = limitText(
    trimText(config.buttonText) || 'Join now',
    24,
  );
  const loyaltyCta = promotionCta;

  const promotionLink = trimText(config.buttonUrl);
  const loyaltyLink = promotionLink;

  const pointsText = limitText(
    trimText(config.pointsText) || '2x points',
    40,
  );
  const validUntil = limitText(trimText(config.validUntil), 60);

  const trackPromotionClick = () => {
    trackThankYouClick(
      'promotion_click',
      {
        ctaText: promotionCta,
        ctaLink: promotionLink,
        itemTitle: promotionHeading,
        itemUrl: promotionLink,
      },
    );
  };
  const trackLoyaltyClick = trackPromotionClick;

  return (
    <s-box padding="base" border="base" borderRadius="large">
      <s-stack gap="base">
        <s-box padding="small" background="subdued" borderRadius="base">
          <s-text type="strong">{pointsText}</s-text>
        </s-box>
        <s-text type="strong">{loyaltyHeading}</s-text>
        {/* <s-text>{loyaltyText}</s-text> */}
         {renderRichText(
            loyaltyText,
            trackLoyaltyClick,
          )}

        {loyaltyLink && (
          <s-button
            href={loyaltyLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={trackLoyaltyClick}
          >
            {loyaltyCta}
          </s-button>
        )}

        {validUntil && (
          <s-text>
            Valid till{" "}
            {!isNaN(new Date(validUntil).getTime())
              ? new Date(validUntil).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })
              : validUntil}
          </s-text>
        )}
      </s-stack>
    </s-box>
  );
}


function replaceReferralVariables(value, config) {
  if (typeof value !== 'string') return '';
  const cfg = config || {};
  return value
    .replaceAll('{friend_reward}', trimText(cfg.friendReward) || '15%')
    .replaceAll('{advocate_reward}', trimText(cfg.advocateReward) || '$10')
    .replaceAll('{referral_code}', trimText(cfg.referralCode) || 'THANKYOU15')
    .replaceAll('{referral_link}', trimText(cfg.referralLink) || '');
}

function parseRichText(value) {
  if (!value) return [];

  try {
    let parsed = JSON.parse(value);

    while (typeof parsed === "string") {
      parsed = JSON.parse(parsed);
    }

    if (Array.isArray(parsed)) return parsed;
    return parsed?.content || [];
  } catch {
    return [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: cleanText(value),
          },
        ],
      },
    ];
  }
}

function renderRichText(nodes = [], onLinkPress) {
  return nodes.map((node, index) => (
    <RichTextBlock
      key={index}
      node={node}
      onLinkPress={onLinkPress}
    />
  ));
}

function RichTextBlock({node, onLinkPress}) {
  switch (node.type) {
    case "heading":
      return (
        <s-text type="strong">
          {node.text || renderInline(node.content, onLinkPress)}
        </s-text>
      );

    case "paragraph":
      return (
        <s-text>
          {renderInline(node.content, onLinkPress)}
        </s-text>
      );

    case "bulletList":
      return (
        <>
          {node.content?.map((item, index) => (
            <s-text key={index}>
              • {renderInline(getListItemContent(item), onLinkPress)}
            </s-text>
          ))}
        </>
      );

    case "orderedList":
      return (
        <>
          {node.content?.map((item, index) => (
            <s-text key={index}>
              {index + 1}. {renderInline(getListItemContent(item), onLinkPress)}
            </s-text>
          ))}
        </>
      );

    case "bullet":
      return (
        <s-text>
          • {renderInline(node.content, onLinkPress)}
        </s-text>
      );

    case "number":
      return (
        <s-text>
          {node.index || 1}. {renderInline(node.content, onLinkPress)}
        </s-text>
      );

    default:
      return null;
  }
}

function renderInline(nodes = [], onLinkPress) {
  return nodes.map((node, index) => {
    if (node.type === "hardBreak") return " ";

    if (node.type !== "text") {
      return node.content
        ? renderInline(node.content, onLinkPress)
        : null;
    }

    let content = node.text || "";

    if (node.marks?.some((mark) => mark.type === "bold")) {
      content = (
        <s-text type="strong">
          {content}
        </s-text>
      );
    }

    const link = node.marks?.find((mark) => mark.type === "link");

    if (link?.attrs?.href) {
      content = (
        <s-link
          to={link.attrs.href}
          onPress={onLinkPress}
        >
          {content}
        </s-link>
      );
    }

    return <>{content}</>;
  });
}

function getListItemContent(item) {
  return item?.content?.[0]?.content || item?.content || [];
}

function cleanText(value) {
  return trimText(
    String(value || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">"),
  );
}

