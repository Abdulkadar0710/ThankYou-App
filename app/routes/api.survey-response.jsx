/* eslint-env node */
import prisma from '../db.server';

export function cors(response) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization',
  );
  response.headers.set('Access-Control-Max-Age', '7200');
  return response;
}

function responseJson(data, status = 200) {
  return cors(
    new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }),
  );
}

export async function action({request}) {
  try {
    if (request.method === 'OPTIONS') {
      return cors(new Response(null, {status: 204}));
    }

    const body = await parseRequestBody(request);
    const shop = normalizeShop(body.shop);
    const orderId = body.orderId ? String(body.orderId).trim() : null;
    const orderNumber = body.orderNumber ? String(body.orderNumber).trim() : null;
    const blockId = body.blockId ? String(body.blockId).trim() : null;
    const answers = body.answers;

    if (!shop) {
      return responseJson({success: false, message: 'Shop is required'}, 400);
    }

    if (!answers || (Array.isArray(answers) && answers.length === 0)) {
      return responseJson({success: false, message: 'Answers are required'}, 400);
    }

    const answersJson =
      typeof answers === 'string' ? answers : JSON.stringify(answers);

    if (orderId) {
      const existing = await prisma.customerSurveyResponse.findFirst({
        where: { shop, orderId },
      });

      if (existing) {
        const updated = await prisma.customerSurveyResponse.update({
          where: { id: existing.id },
          data: {
            answers: answersJson,
            blockId: blockId || existing.blockId,
            orderNumber: orderNumber || existing.orderNumber,
          },
        });
        return responseJson({
          success: true,
          id: updated.id,
        });
      }
    }

    const record = await prisma.customerSurveyResponse.create({
      data: {
        shop,
        orderId,
        orderNumber,
        blockId,
        answers: answersJson,
      },
    });

    return responseJson({
      success: true,
      id: record.id,
    });
  } catch (error) {
    console.error('Error in /api/survey-response:', error);
    return responseJson(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
      },
      500,
    );
  }
}

export async function loader({request}) {
  if (request.method === 'OPTIONS') {
    return cors(new Response(null, {status: 204}));
  }
  return responseJson({message: 'Survey response endpoint'});
}

async function parseRequestBody(request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return request.json().catch(() => ({}));
  }

  const text = await request.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

function normalizeShop(value) {
  if (!value) return '';

  const text = String(value).trim();
  if (!text) return '';

  try {
    return new URL(text).hostname.toLowerCase();
  } catch {
    return text
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .toLowerCase();
  }
}
