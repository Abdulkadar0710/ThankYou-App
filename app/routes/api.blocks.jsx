/* eslint-env node */
import {isBlockType, parseBlockConfig} from '../models/thankYouBlock';
import {getActiveBlock} from '../models/thankYouBlock.server';

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

function json(data, init = {}) {
  return cors(
    new Response(JSON.stringify(data), {
      status: init.status || 200,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    }),
  );
}

export async function loader({request}) {
  if (request.method === 'OPTIONS') {
    return cors(new Response(null, {status: 204}));
  }

  try {
    const url = new URL(request.url);
    const shop = url.searchParams.get('shop');
    const type = url.searchParams.get('type');

    if (!shop || !isBlockType(type)) {
      return json({
        success: false,
        message: 'Shop and valid block type are required',
      });
    }

    const block = await getActiveBlock(shop, type);

    if (!block) {
      return json({
        success: true,
        block: null,
      });
    }

    return json({
      success: true,
      block: {
        id: block.id,
        type: block.type,
        name: block.name,
        status: block.status,
        config: parseBlockConfig(block.config),
        updatedAt: block.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error in /api/blocks:', error);

    return json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error',
      },
      {status: 500},
    );
  }
}

export async function action({request}) {
  if (request.method === 'OPTIONS') {
    return cors(new Response(null, {status: 204}));
  }

  return loader({request});
}

