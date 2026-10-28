import '@shopify/ui-extensions/preact';
import {render} from "preact";
import {useEffect, useState} from "preact/hooks";
import {trackThankYouClick} from '../../shared/analytics';
import {limitText, trimText} from '../../shared/text';
import {fetchActiveBlock} from '../../shared/blocks';
import {claimExtensionRender} from '../../shared/render-once';

export default () => {
  try {
    if (!claimExtensionRender('referral')) return;

    render(<Extension />, document.body);
  } catch (error) {
    console.error('Extension failed to render:', error);
  }
};

function Extension() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveBlock('referral')
      .then((block) => {
        setConfig(block?.config || null);
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
          </s-stack>
        </s-box>
      </s-stack>
    );
  }

  if (!config) return null;

  const referralHeading = limitText(
    trimText(config.title) || 'Refer friends. Get rewards.',
    48,
  );
  const referralContent = parseRichText(
    replaceReferralVariables(
      config.description || "",
      config,
    ),
  );
  const referralCta = limitText(
    trimText(config.shareText) || 'Share',
    24,
  );
  const referralLink = trimText(config.referralLink);
  const referralCode = limitText(
    trimText(config.referralCode) || 'THANKYOU15',
    40,
  );
  const shareLabel = limitText(
    trimText(config.shareLabel) || 'Share now:',
    40,
  );

  const trackReferralClick = () => {
    trackThankYouClick(
      'referral_click',
      {
        ctaText: referralCta,
        ctaLink: referralLink,
        itemTitle: referralHeading,
        itemUrl: referralLink,
      },
    );
  };

  const trackCopyCode = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(referralCode).catch(() => {});
    }

    trackThankYouClick(
      'referral_code_copy',
      {
        ctaText: 'Copy code',
        itemTitle: referralHeading,
        itemId: referralCode,
      },
    );
  };

  if (!referralLink && !referralCode) return null;

  return (
    <s-box padding="base" border="base" borderRadius="large">
      <s-stack gap="base">
        <s-box padding="small" background="subdued" borderRadius="base">
          <s-text type="strong">{referralHeading}</s-text>
        </s-box>

        <s-stack gap="small">
          {renderRichText(
            referralContent,
            trackReferralClick,
          )}
        </s-stack>

        <s-stack gap="small">
          <s-text>{shareLabel}</s-text>

          <s-stack direction="inline" gap="small">
            {referralCode && (
              <s-button variant="secondary" onClick={trackCopyCode}>
                {referralCode}
              </s-button>
            )}
          </s-stack>
        </s-stack>
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
