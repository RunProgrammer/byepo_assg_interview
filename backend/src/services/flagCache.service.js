/**
 * Simple in-memory cache for feature flag lookups.
 *
 * Cache key: `${orgId}:${featureKey}`
 * TTL: 60 seconds
 *
 * In production, this would be Redis with org-scoped key invalidation.
 * The trade-off here: memory cache is zero-dependency and sufficient for
 * a single-instance deployment. Redis would be needed for horizontal scaling.
 */

const TTL_MS = 60 * 1000; // 60 seconds

const cache = new Map(); // key -> { value, expiresAt }

function getFromCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCache(key, value) {
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

function deleteFromCache(key) {
  cache.delete(key);
}

/**
 * Invalidate all cached entries for a given org.
 * Called whenever a flag is created, updated, or deleted.
 */
function invalidateOrgCache(orgId) {
  for (const key of cache.keys()) {
    if (key.startsWith(`${orgId}:`)) {
      cache.delete(key);
    }
  }
}

module.exports = { getFromCache, setCache, deleteFromCache, invalidateOrgCache };
