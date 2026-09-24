import {useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs} from "react-router";
import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import {useAppBridge} from "@shopify/app-bridge-react";
import {checkoutEditorUrl} from "../utils/checkoutEditor.server";
import {
  blockTemplates,
  isBlockType,
  parseBlockConfig,
} from "../models/thankYouBlock";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const blocks = await prisma.thankYouBlock.findMany({
    where: { shop: session.shop },
    orderBy: { updatedAt: "desc" },
  });

  return {
    checkoutCustomizeUrl: await checkoutEditorUrl(session.shop, admin),
    templates: Object.values(blockTemplates).filter(
      (template) => !("deprecated" in template && template.deprecated),
    ),
    blocks: blocks.map((block) => ({
      ...block,
      config: parseBlockConfig(block.config),
      createdAt: block.createdAt.toISOString(),
      updatedAt: block.updatedAt.toISOString(),
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    const blockId = String(formData.get("blockId"));

    const deleted = await prisma.thankYouBlock.deleteMany({
      where: {
        id: blockId,
        shop: session.shop,
      },
    });

    return Response.json({
      success: deleted.count > 0,
    });
  }

  return Response.json({
    success: false,
  });
};

export default function BlocksPage() {
  const { checkoutCustomizeUrl, templates, blocks } =
    useLoaderData<typeof loader>();
  const shopify = useAppBridge();
  const existingTypes = new Set(blocks.map((block) => block.type));

  const handleDelete = async (blockId: string, blockName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${blockName}"?`,
    );

    if (!confirmed) return;

    const formData = new FormData();
    formData.append("intent", "delete");
    formData.append("blockId", blockId);

    const token = await shopify.idToken();
    const response = await fetch(window.location.pathname, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (response.ok) {
      window.location.reload();
    } else {
      alert("Failed to delete block");
    }
  };

  return (
    <s-page heading="Checkout Blocks">
      <s-button
        slot="primary-action"
        href={checkoutCustomizeUrl}
        target="_blank"
      >
        Edit thank-you page
      </s-button>

      <s-section heading="Select a template">
        <s-grid
          gap="base"
          gridTemplateColumns="repeat(auto-fit, minmax(260px, 1fr))"
        >
          {templates.map((template) => (
            <s-box
              key={template.type}
              padding="base"
              borderWidth="base"
              borderRadius="base"
            >
              <s-stack gap="base">
                <TemplatePreview type={template.type} />
                <s-stack gap="small-200">
                  <s-heading>{template.title}</s-heading>
                  <s-paragraph>{template.description}</s-paragraph>
                </s-stack>
                {existingTypes.has(template.type) ? (
                  <s-button disabled>
                    Already added
                  </s-button>
                ) : (
                  <s-button href={`/app/blocks/new?type=${template.type}`}>
                    Add block
                  </s-button>
                )}
              </s-stack>
            </s-box>
          ))}
        </s-grid>
      </s-section>

      <s-section heading="App blocks">
        {blocks.length ? (
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Name</s-table-header>
              <s-table-header>Type</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Updated</s-table-header>
              <s-table-header>Action</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {blocks.map((block) => (
                <s-table-row key={block.id}>
                  <s-table-cell>{block.name}</s-table-cell>
                  <s-table-cell>{blockTitle(block.type)}</s-table-cell>
                  <s-table-cell>{capitalize(block.status)}</s-table-cell>
                  <s-table-cell>{formatDate(block.updatedAt)}</s-table-cell>
                    <s-table-cell>
                      <div
                        style={{
                          display: "flex",
                          gap: "12px",
                          alignItems: "center",
                        }}
                      >
                        <s-link href={`/app/blocks/${block.id}`}>
                          Edit
                        </s-link>

                        <button
                          type="button"
                          onClick={() => handleDelete(block.id, block.name)}
                          style={{
                            border: "none",
                            background: "none",
                            color: "#d82c0d",
                            cursor: "pointer",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        ) : (
          <s-paragraph>
            No app blocks yet. Choose a template above to create one.
          </s-paragraph>
        )}
      </s-section>
    </s-page>
  );
}

function TemplatePreview({ type }: { type: string }) {
  const previewImages: Record<string, string> = {
    faq: "/faq-preview.png",
    image: "/image-preview.png",
    video: "/video-preview.png",
    media: "media-preview.png",
    referral: "/referral-preview.png",
    loyalty: "/loyalty-preview.png",
    discount: "/discount-preview.png",
    subscription: "/subscription-preview.png",
    upsell: "/upsell-preview.png",
    checkoutUpsell: "/checkout-upsell-preview.png",
  };
  const fallbackPreviews: Record<string, string> = {
    freeShippingProgress: "Free Shipping Progress Bar",
    giftOptions: "Gift Options",
    howDidYouHear: "How did you hear about us?",
  };

  if (!previewImages[type]) {
    return (
      <div
        style={{
          alignItems: "center",
          background: "#f6f6f7",
          border: "1px solid #dfe3e8",
          borderRadius: "8px",
          display: "flex",
          height: "140px",
          justifyContent: "center",
          padding: "16px",
          textAlign: "center",
        }}
      >
        <s-text type="strong">{fallbackPreviews[type] || type}</s-text>
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px solid #dfe3e8",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <img
        src={previewImages[type]}
        alt={`${type} preview`}
        style={{
          width: "100%",
          height: "140px",
          objectFit: "contain",
          display: "block",
        }}
      />
    </div>
  );
}

// function TemplatePreview({ type }: { type: string }) {
//   if (type === "faq") {
//     return (
//       <s-box padding="base" borderWidth="base" borderRadius="base">
//         <s-stack gap="small">
//           <s-text type="strong">What is your policy on returns? +</s-text>
//           <s-text type="strong">What are your delivery times? +</s-text>
//           <s-text type="strong">How can I get assistance with my order? +</s-text>
//         </s-stack>
//       </s-box>
//     );
//   }

//   if (type === "image" || type === "video" || type === "media") {
//     return (
//       <s-box padding="base" borderWidth="base" borderRadius="base">
//         <s-box minBlockSize="120px" background="subdued" borderRadius="base" />
//       </s-box>
//     );
//   }

//   if (type === "referral") {
//     return (
//       <s-box padding="base" borderWidth="base" borderRadius="base">
//         <s-stack gap="small">
//           <s-text type="strong">Refer friends. Get rewards.</s-text>
//           <s-text>Give 15% off and earn a reward after their purchase.</s-text>
//           <s-stack direction="inline" gap="small">
//             {/* <s-button>Share</s-button> */}
//             <s-button variant="secondary">Copy code</s-button>
//           </s-stack>
//         </s-stack>
//       </s-box>
//     );
//   }

//   if (type === "loyalty") {
//     return (
//       <s-box padding="base" borderWidth="base" borderRadius="base">
//         <s-stack gap="small">
//           <s-box padding="small" background="subdued" borderRadius="base">
//             <s-text type="strong">2x points</s-text>
//           </s-box>
//           <s-text>Join our loyalty program and unlock rewards.</s-text>
//           <s-button>Join now</s-button>
//         </s-stack>
//       </s-box>
//     );
//   }

//   return (
//     <s-box padding="base" borderWidth="base" borderRadius="base">
//       <s-grid gap="small" gridTemplateColumns="1fr 1fr">
//         <s-box minBlockSize="90px" background="subdued" borderRadius="base" />
//         <s-box minBlockSize="90px" background="subdued" borderRadius="base" />
//       </s-grid>
//     </s-box>
//   );
// }

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function blockTitle(type: string) {
  return isBlockType(type) ? blockTemplates[type].title : type;
}
