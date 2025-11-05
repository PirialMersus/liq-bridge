// scripts/renewSession.js
import 'dotenv/config';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import readline from 'node:readline/promises';

const apiId = Number(process.env.TELEGRAM_API_ID || 0);
const apiHash = process.env.TELEGRAM_API_HASH || '';
if (!apiId || !apiHash) {
  console.error('Set TELEGRAM_API_ID and TELEGRAM_API_HASH in .env first');
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => rl.question(q);

const client = new TelegramClient(new StringSession(''), apiId, apiHash, { connectionRetries: 5 });

try {
  await client.start({
    phoneNumber: async () => await ask('Phone (+380...): '),
    phoneCode: async () => await ask('Code (from Telegram): '),
    password: async () => await ask('2FA password (if any, else Enter): '),
    onError: (e) => console.error('Login error:', e?.message || e),
  });
  const s = client.session.save();
  console.log('SESSION=' + s);
} catch (e) {
  console.error('Auth failed:', e?.message || e);
} finally {
  rl.close();
  process.exit(0);
}
