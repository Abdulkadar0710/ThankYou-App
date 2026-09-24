/* eslint-env node */
import prisma from '../db.server';

export async function action({request}) {
  try {
    if (request.method === 'OPTIONS') {
      return responseJson({});
    }

    const body = await parseRequestBody(request);
    const {
      eventType = 'subscription_click',
      orderId,
      orderNumber,
      ctaText,
      ctaLink,
      itemId,
      itemTitle,
      itemUrl,
      source,
    } = body;
    const shop = normalizeShop(body.shop);

    if (!shop) {
      return responseJson({
        success: false,
        message: 'Shop is required',
      });
    }

    const click =
      await prisma.subscriptionClick.create({
        data: {
          shop,
          eventType,
          orderId: orderId || null,
          orderNumber: orderNumber || null,
          ctaText: ctaText || null,
          ctaLink: ctaLink || null,
          itemId: itemId || null,
          itemTitle: itemTitle || null,
          itemUrl: itemUrl || null,
          source: source || null,
          payload: JSON.stringify(body),
        },
      });

    return responseJson({
      success: true,
      id: click.id,
    });
  } catch (error) {
    console.error(error);

    return responseJson({
      success: false,
      message: error.message,
    });
  }
}

export async function loader() {
  return responseJson({});
}

function responseJson(data) {
  return new Response(
    JSON.stringify(data),
    {
      status: 200,
      headers: {
        'Content-Type':
          'application/json',
        'Access-Control-Allow-Origin':
          '*',
        'Access-Control-Allow-Methods':
          'POST, OPTIONS',
        'Access-Control-Allow-Headers':
          'Content-Type',
      },
    },
  );
}

async function parseRequestBody(request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return request.json();
  }

  const text = await request.text();

  return text ? JSON.parse(text) : {};
}

function normalizeShop(value) {
  if (!value) return '';

  const text = String(value).trim();

  if (!text) return '';

  try {
    return new URL(text).hostname.toLowerCase();
  } catch (error) {
    return text
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .toLowerCase();
  }
}
