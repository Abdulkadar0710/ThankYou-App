import prisma from "../db.server";

export async function getActiveBlock(shop: string, type: string) {
  const types =
    type === "promotion" || type === "loyalty"
      ? ["promotion", "loyalty"]
      : [type];

  return prisma.thankYouBlock.findFirst({
    where: {shop, type: {in: types}, status: "active"},
    orderBy: {updatedAt: "desc"},
  });
}