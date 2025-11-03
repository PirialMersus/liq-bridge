// src/bridge.js
import 'dotenv/config';
import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { sleep } from 'telegram/Helpers.js';
import { FORWARD_TIMEOUT_MS } from './constants.js';

let client;
let connecting;

const apiId = Number(process.env.TELEGRAM_API_ID || 0);
const apiHash = process.env.TELEGRAM_API_HASH || '';
const sessionStr = process.env.TELEGRAM_SESSION || '';
if (!apiId || !apiHash) throw new Error('Missing TELEGRAM_API_ID/TELEGRAM_API_HASH');

async function getClient() {
  if (client) return client;
  if (connecting) return connecting;
  connecting = (async () => {
    const c = new TelegramClient(new StringSession(sessionStr), apiId, apiHash, { connectionRetries: 5 });
    await c.start();
    client = c;
    return c;
  })();
  return connecting;
}

function isImage(m) {
  if (!m) return false;
  if (m.photo) return true;
  const d = m.document;
  return !!(d && (d.mimeType?.startsWith?.('image/') || /(\.png|\.jpg|\.jpeg|\.webp)$/i.test(d.attributes?.fileName || '')));
}

export async function fetchAndForwardMap({ sourceBot, staging, pair }) {
  const c = await getClient();
  const bot = sourceBot.startsWith('@') ? sourceBot : '@' + sourceBot;
  const channel = staging.startsWith('@') ? staging : '@' + staging;

  const botEntity = await c.getEntity(bot);
  const chEntity = await c.getEntity(channel);

  const pairUp = String(pair || 'BTCUSDT').toUpperCase();

  const msgPair = await c.sendMessage(botEntity, { message: pairUp }).catch(() => null);
  if (!msgPair) return { ok: false, errorText: 'send-failed' };

  const infinite = Number(FORWARD_TIMEOUT_MS) <= 0;
  const deadline = infinite ? Number.MAX_SAFE_INTEGER : Date.now() + Number(FORWARD_TIMEOUT_MS || 0);

  while (Date.now() < deadline) {
    const msgs = await c.getMessages(botEntity, { limit: 25 });
    const firstFresh = msgs.find(m => (m.id || 0) > (msgPair.id || 0));
    if (!firstFresh) { await sleep(700); continue; }

    if (isImage(firstFresh)) {
      let fwd;
      try {
        fwd = await c.forwardMessages(chEntity, { messages: [firstFresh.id], fromPeer: botEntity, dropAuthor: true });
      } catch {
        fwd = null;
      }
      const fwdMsg = Array.isArray(fwd) ? fwd[0] : fwd;
      if (fwdMsg?.id) {
        try {
          await c.invoke(new Api.messages.EditMessage({ peer: chEntity, id: fwdMsg.id, message: `#liq ${pairUp}` }));
        } catch {
          await c.sendMessage(chEntity, { message: `#liq ${pairUp}` }).catch(() => {});
        }
        return { ok: true };
      } else {
        await c.sendMessage(chEntity, { message: `#liq ${pairUp}` }).catch(() => {});
        return { ok: true };
      }
    } else {
      const text = (typeof firstFresh.message === 'string' ? firstFresh.message.trim() : '') || 'error';
      return { ok: false, errorText: text };
    }
  }

  return { ok: false, errorText: 'timeout' };
}
