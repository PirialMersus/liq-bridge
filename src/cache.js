// src/cache.js
const cache = new Map();
export function put(pair, fileId) {
  cache.set(pair, { file_id: fileId, ts: Date.now() });
}
export function get(pair, ttlMs) {
  const v = cache.get(pair);
  if (!v) return null;
  if (Date.now() - v.ts > ttlMs) { cache.delete(pair); return null; }
  return v;
}
export function stats() {
  return [...cache.entries()].map(([k,v]) => ({ pair:k, ageMs:Date.now()-v.ts }));
}
