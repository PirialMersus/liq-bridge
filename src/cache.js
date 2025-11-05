// src/cache.js
const cache = new Map();

export function put(pair, fileId, snapshotTs) {
  cache.set(pair, {
    file_id: fileId,
    snapshot_ts: Number(snapshotTs || Date.now()),
    cached_at: Date.now(),
  });
}

export function get(pair, ttlMs) {
  const v = cache.get(pair);
  if (!v) return null;
  if (ttlMs && (Date.now() - v.cached_at > ttlMs)) {
    cache.delete(pair);
    return null;
  }
  return v;
}
