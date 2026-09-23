/* eslint-env node */
import {unauthenticated} from '../shopify.server';

const GIFT_WRAP_PRODUCT_ID = 'gid://shopify/Product/8283468398681';

export async function loader({request}) {
  const url = new URL(request.url);
  const shop = normalizeShop(url.searchParams.get('shop') || '');

  if (!shop) {
    return responseJson({success: false, variants: [], message: 'Shop required'});
  }

  try {
    const {admin} = await unauthenticated.admin(shop);

    const data = await admin.graphql(
      `
        query GetGiftWrapVariants($id: ID!) {
          product(id: $id) {
            id
            title
            variants(first: 20) {
              nodes {
                id
                title
                price
                availableForSale
                image {
                  url
                  altText
                }
              }
            }
          }
        }
      `,
      {variables: {id: GIFT_WRAP_PRODUCT_ID}},
    );

    const json = await data.json();
    const product = json?.data?.product;

    if (!product) {
      return responseJson({success: false, variants: [], message: 'Gift wrap product not found'});
    }

    const variants = (product.variants?.nodes || []).map((v) => ({
      id: v.id,
      title: v.title,
      price: v.price,
      availableForSale: v.availableForSale,
      image: v.image?.url || null,
    }));

    return responseJson({success: true, variants, productTitle: product.title});
  } catch (err) {
    console.error('Gift wrap variants error:', err);
    return responseJson({success: false, variants: [], message: err?.message || 'Failed to load variants'});
  }
}

export async function action() {
  return responseJson({});
}

function normalizeShop(value) {
  if (!value) return '';
  const text = String(value).trim();
  try {
    return new URL(text).hostname.toLowerCase();
  } catch {
    return text.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
  }
}

function responseJson(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
