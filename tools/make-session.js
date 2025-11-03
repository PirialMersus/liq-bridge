// tools/make-session.js
import 'dotenv/config';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { createInterface } from 'node:readline/promises';

const apiId = Number(process.env.TELEGRAM_API_ID || 0);
const apiHash = process.env.TELEGRAM_API_HASH || '';

if (!apiId || !apiHash) {
  console.error('Set TELEGRAM_API_ID and TELEGRAM_API_HASH in .env before running this script.');
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });

async function ask(label) {
  const v = (await rl.question(label)).trim();
  return v;
}

(async () => {
  try {
    const client = new TelegramClient(new StringSession(''), apiId, apiHash, {
      connectionRetries: 5
    });

    await client.start({
      phoneNumber: async () => await ask('Phone number (+380...): '),
      phoneCode:   async () => await ask('Login code (from Telegram): '),
      password:    async () => await ask('2FA password (if set, else leave empty): '),
      onError: (err) => {
        console.error('Auth error:', err?.message || err);
      }
    });

    const session = client.session.save();
    console.log('\n=== COPY THIS INTO .env AS TELEGRAM_SESSION ===\n');
    console.log(session);
    console.log('\n==============================================\n');

    await client.disconnect();
    await rl.close();
    process.exit(0);
  } catch (e) {
    console.error('Failed to create session:', e);
    try { await rl.close(); } catch {}
    process.exit(1);
  }
})();
