// src/constants.js
export const TTL_MS = Number(process.env.TTL_MS || 15 * 60 * 1000);
export const FORWARD_TIMEOUT_MS = Number(process.env.FORWARD_TIMEOUT_MS || 90 * 1000);
export const CACHE_WAIT_MS = Number(process.env.CACHE_WAIT_MS || 90 * 1000);
export const SYMBOL_MAP = { BTC: 'BTCUSDT', ETH: 'ETHUSDT', PAXG: 'PAXGUSDT' };
export function toPair(s) { const x = String(s || '').trim().toUpperCase().replace(/USDT$/,'').replace(/[^\w]/g,''); return SYMBOL_MAP[x] || `${x}USDT`; }
