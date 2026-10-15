/* eslint-env node */
import {unauthenticated} from '../shopify.server';
import {getActiveBlock} from '../models/thankYouBlock.server';
import {parseBlockConfig} from '../models/thankYouBlock';

// In-memory cache for delivery profiles by shop
const cache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

const DELIVERY_PROFILES_QUERY = `
  query GetDeliveryProfiles {
    deliveryProfiles(first: 10) {
      edges {
        node {
          id
          name
          profileLocationGroups {
            locationGroupZones(first: 20) {
              edges {
                node {
                  zone {
                    id
                    name
                    countries {
                      code {
                        countryCode
                        restOfWorld
                      }
                      provinces {
                        code
                        name
                      }
                    }
                  }
                  methodDefinitions(first: 50) {
                    edges {
                      node {
                        id
                        name
                        active
                        rateProvider {
                          __typename
                          ... on DeliveryRateDefinition {
                            id
                            price {
                              amount
                              currencyCode
                            }
                          }
                        }
                        methodConditions {
                          id
                          field
                          operator
                          conditionCriteria {
                            __typename
                            ... on MoneyV2 {
                              amount
                              currencyCode
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export async function loader({request}) {
  if (request.method === 'OPTIONS') {
    return responseJson({});
  }

  const url = new URL(request.url);
  const shop = normalizeShop(url.searchParams.get('shop') || '');
  const methodName = (url.searchParams.get('methodName') || '').trim();
  const countryCode = (url.searchParams.get('countryCode') || '').trim();
  const provinceCode = (url.searchParams.get('provinceCode') || '').trim();

  if (!shop) {
    return responseJson({
      success: false,
      threshold: null,
      message: 'Shop parameter is required',
    });
  }

  try {
    const cached = cache.get(shop);
    let profilesData = null;

    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      profilesData = cached.data;
    } else {
      try {
        const {admin} = await unauthenticated.admin(shop);
        const res = await admin.graphql(DELIVERY_PROFILES_QUERY);
        const json = await res.json();
        profilesData = json?.data;
        if (profilesData) {
          cache.set(shop, {data: profilesData, timestamp: Date.now()});
        }
      } catch (gqlErr) {
        console.warn('Admin deliveryProfiles query failed, falling back to configured block rules:', gqlErr?.message || gqlErr);
      }
    }

    if (profilesData) {
      const result = findFreeShippingThreshold(profilesData, {
        methodName,
        countryCode,
        provinceCode,
      });

      if (result.threshold !== null) {
        return responseJson({
          success: true,
          threshold: result.threshold,
          currencyCode: result.currencyCode,
          methodName: result.matchedMethodName,
          zoneName: result.matchedZoneName,
        });
      }
    }

    // Fallback to active block's configured method rules if deliveryProfiles GQL is restricted
    const activeBlock = await getActiveBlock(shop, 'freeShippingProgress');
    if (activeBlock?.config) {
      const config = parseBlockConfig(activeBlock.config);
      const ruleThreshold = parseMethodRuleThreshold(config.freeShippingMethodRules, methodName);
      const threshold = ruleThreshold || (Number(config.freeShippingThreshold) > 0 ? Number(config.freeShippingThreshold) : null);

      if (threshold !== null) {
        return responseJson({
          success: true,
          threshold,
          currencyCode: null,
          methodName: methodName || null,
          source: 'blockConfig',
        });
      }
    }

    return responseJson({
      success: true,
      threshold: null,
      currencyCode: null,
      methodName: methodName || null,
    });
  } catch (err) {
    console.error('Error fetching shipping threshold:', err);
    return responseJson(
      {
        success: false,
        threshold: null,
        message: err?.message || 'Internal error fetching shipping threshold',
      },
      {status: 500},
    );
  }
}

export async function action({request}) {
  if (request.method === 'OPTIONS') {
    return responseJson({});
  }
  return loader({request});
}

function findFreeShippingThreshold(profilesData, {methodName, countryCode, provinceCode}) {
  let matchedThreshold = null;
  let currencyCode = null;
  let matchedMethodName = null;
  let matchedZoneName = null;

  for (const profileEdge of profilesData.deliveryProfiles?.edges || []) {
    const profile = profileEdge.node;
    for (const locationGroup of profile.profileLocationGroups || []) {
      for (const zoneEdge of locationGroup.locationGroupZones?.edges || []) {
        const {zone, methodDefinitions} = zoneEdge.node || {};
        if (!zone || !methodDefinitions) continue;

        let zoneMatches = false;
        if (countryCode) {
          const countryMatch = zone.countries?.find(
            (c) =>
              c.code?.countryCode?.toUpperCase() === countryCode.toUpperCase(),
          );
          if (countryMatch) {
            if (provinceCode && countryMatch.provinces?.length > 0) {
              const provMatch = countryMatch.provinces.find(
                (p) =>
                  p.code?.toUpperCase() === provinceCode.toUpperCase() ||
                  p.name?.toUpperCase() === provinceCode.toUpperCase(),
              );
              zoneMatches = Boolean(provMatch);
            } else {
              zoneMatches = true;
            }
          } else {
            // Check rest of world
            const rowMatch = zone.countries?.find((c) => c.code?.restOfWorld);
            if (rowMatch) zoneMatches = true;
          }
        } else {
          // If no destination country provided yet, consider active zones
          zoneMatches = true;
        }

        if (!zoneMatches) continue;

        for (const methodEdge of methodDefinitions.edges || []) {
          const method = methodEdge.node;
          if (!method || !method.active) continue;

          // Check if this method definition matches the selected method title
          const isMethodMatch = methodName
            ? method.name.trim().toLowerCase() === methodName.trim().toLowerCase() ||
              methodName.trim().toLowerCase().includes(method.name.trim().toLowerCase()) ||
              method.name.trim().toLowerCase().includes(methodName.trim().toLowerCase())
            : true;

          if (!isMethodMatch) continue;

          // Check if rate provider is 0 (free delivery)
          const priceAmount = Number(method.rateProvider?.price?.amount);
          if (Number.isFinite(priceAmount) && priceAmount === 0) {
            // Find condition: TOTAL_PRICE >= threshold
            const priceCond = method.methodConditions?.find(
              (c) =>
                c.field === 'TOTAL_PRICE' &&
                c.operator === 'GREATER_THAN_OR_EQUAL_TO',
            );

            if (priceCond?.conditionCriteria?.amount) {
              const thresh = Number(priceCond.conditionCriteria.amount);
              if (Number.isFinite(thresh) && thresh > 0) {
                matchedThreshold = thresh;
                currencyCode = priceCond.conditionCriteria.currencyCode;
                matchedMethodName = method.name;
                matchedZoneName = zone.name;
                break;
              }
            }
          }
        }

        if (matchedThreshold !== null) break;
      }
      if (matchedThreshold !== null) break;
    }
    if (matchedThreshold !== null) break;
  }

  return {
    threshold: matchedThreshold,
    currencyCode,
    matchedMethodName,
    matchedZoneName,
  };
}

function parseMethodRuleThreshold(rulesText, methodName) {
  if (!rulesText || typeof rulesText !== 'string') return null;
  const lines = rulesText.split('\n');
  const target = (methodName || '').trim().toLowerCase();

  for (const line of lines) {
    const parts = line.split(':');
    if (parts.length >= 2) {
      const name = parts[0].trim().toLowerCase();
      const amount = parseFloat(parts[1].trim());
      if (Number.isFinite(amount) && amount > 0) {
        if (!target || target.includes(name) || name.includes(target)) {
          return amount;
        }
      }
    }
  }
  return null;
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

function responseJson(data, init = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status || 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '7200',
    },
  });
}
