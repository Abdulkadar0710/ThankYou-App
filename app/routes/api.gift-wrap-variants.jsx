/* eslint-env node */
import {unauthenticated} from '../shopify.server';

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
        query GetGiftWrapProduct {
          products(first: 1, query: "title:'Gift Wrapping'") {
            nodes {
              id
              title
              featuredImage {
                url
                altText
              }
              options {
                id
                name
                values
              }
              variants(first: 50) {
                nodes {
                  id
                  title
                  price
                  availableForSale
                  image {
                    url
                    altText
                  }
                  selectedOptions {
                    name
                    value
                  }
                }
              }
            }
          }
        }
      `,
    );

    const json = await data.json();
    const product = json?.data?.products?.nodes?.[0];

    if (!product) {
      return responseJson({success: false, variants: [], options: [], message: 'Gift wrap product not found'});
    }

    const options = (product.options || []).map((o) => ({
      id: o.id,
      name: o.name,
      values: o.values || [],
    }));

    const variants = (product.variants?.nodes || []).map((v) => ({
      id: v.id,
      title: v.title,
      price: v.price,
      availableForSale: v.availableForSale,
      image: v.image?.url || null,
      selectedOptions: (v.selectedOptions || []).map((so) => ({
        name: so.name,
        value: so.value,
      })),
    }));

    return responseJson({
      success: true,
      variants,
      options,
      productTitle: product.title,
      productImage: product.featuredImage?.url || null,
    });
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
