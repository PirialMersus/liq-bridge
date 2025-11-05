// src/index.js
import 'dotenv/config';
import express from 'express';
import { Telegraf } from 'telegraf';
import { fetchAndForwardMap, debugPeers } from './bridge.js';
import { get, put } from './cache.js';
import { TTL_MS, toPair, CACHE_WAIT_MS } from './constants.js';

const { BOT_TOKEN, LIQ_SOURCE_BOT, STAGING_CHANNEL, PORT = 3000, HEALTHCHECK_URL } = process.env;
if (!BOT_TOKEN) throw new Error('Missing BOT_TOKEN');
if (!LIQ_SOURCE_BOT) throw new Error('Missing LIQ_SOURCE_BOT');
if (!STAGING_CHANNEL) throw new Error('Missing STAGING_CHANNEL');

const app = express();
app.use(express.json());

const lastPhotoByChat = new Map();

function handleChannelUpdate(ch) {
  const chatId = ch.chat?.id;
  const text = ch.caption || ch.text || '';
  const p = ch.photo?.[ch.photo.length - 1];
  const fileId = p?.file_id || ch.document?.file_id;
  const snapshotTs = ch.date ? ch.date * 1000 : Date.now();
  if (fileId && chatId) lastPhotoByChat.set(chatId, { file_id: fileId, seen_at: Date.now(), snapshot_ts: snapshotTs });
  const m1 = text && text.match(/#liq\s+([A-Z0-9/]+)/i);
  if (m1) {
    const pair = m1[1].toUpperCase().replace('/', '');
    if (fileId) { put(pair, fileId, snapshotTs); return true; }
    const last = lastPhotoByChat.get(chatId);
    if (last && (Date.now() - last.seen_at) < 90_000) { put(pair, last.file_id, last.snapshot_ts); return true; }
  }
  return false;
}

const bot = new Telegraf(BOT_TOKEN);
bot.on('channel_post', async (ctx) => { const ch = ctx.channelPost; if (ch) handleChannelUpdate(ch); });
bot.on('edited_channel_post', async (ctx) => { const ch = ctx.update.edited_channel_post; if (ch) handleChannelUpdate(ch); });
bot.launch().catch(console.error);

app.get('/heatmap', async (req, res) => {
  try {
    const symbol = String(req.query.symbol || '').trim();
    if (!symbol) return res.status(400).json({ ok:false, error:'symbol required' });
    const pair = toPair(symbol);

    const cached = get(pair, TTL_MS);
    if (cached?.file_id) {
      return res.json({
        ok: true,
        source: 'cache',
        pair,
        file_id: cached.file_id,
        ttl_ms: TTL_MS,
        snapshot_ts: cached.snapshot_ts,
        age_ms: Date.now() - cached.cached_at,
      });
    }

    const r = await fetchAndForwardMap({ sourceBot: LIQ_SOURCE_BOT, staging: STAGING_CHANNEL, pair });
    if (!r?.ok) {
      return res.json({ ok:false, pair, error_text: r?.errorText || null });
    }

    const tEnd = Date.now() + CACHE_WAIT_MS;
    while (Date.now() < tEnd) {
      const v = get(pair, TTL_MS);
      if (v?.file_id) {
        return res.json({
          ok: true,
          source: 'forward',
          pair,
          file_id: v.file_id,
          ttl_ms: TTL_MS,
          snapshot_ts: v.snapshot_ts,
          age_ms: Date.now() - v.cached_at,
        });
      }
      await new Promise(r => setTimeout(r, 700));
    }
    return res.status(202).json({ ok:true, source:'forward-pending', pair });
  } catch (e) {
    return res.json({ ok:false, error: e?.message || String(e) });
  }
});

app.get('/', (_req, res) => res.send('liq-bridge ok'));

(async () => {
  const peers = debugPeers();
  console.log('[bridge peers]', peers);
  app.listen(PORT, () => { console.log('Server on :' + PORT); });
})();

if (HEALTHCHECK_URL) setInterval(() => { fetch(HEALTHCHECK_URL).catch(() => {}); }, 60_000);
