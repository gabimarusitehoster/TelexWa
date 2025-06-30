const {
  makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion, DisconnectReason, Browsers
} = require("@fizzxydev/baileys-pro");
const pino = require("pino");
const fs = require("fs");
const path = require("path");
const NodeCache = require("node-cache");
const sessionStore = require("./sessionStore");
const { bot } = require("./bot"); // You must export 'bot' from bot.js

const pairingCodes = new NodeCache({ stdTTL: 3600 });
const msgRetryCounterCache = new NodeCache();

async function startSession(phoneNumber, telegramChatId, onStatus, onMessage) {
  const sessionPath = path.join(__dirname, "tmp", `session_${phoneNumber}`);
  if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: Browsers.windows('Firefox'),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" }))
    },
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    msgRetryCounterCache,
    defaultQueryTimeoutMs: undefined,
  });

  if (sock.authState.creds.registered) {
    await saveCreds();
    console.log(`🔄 Reconnected to ${phoneNumber}`);
  } else {
    if (telegramChatId) {
      setTimeout(async () => {
        const custom = "GABIMARU";
        let code = await sock.requestPairingCode(phoneNumber, custom);
        code = code?.match(/.{1,4}/g)?.join("-") || code;
        pairingCodes.set(code, { count: 0, phoneNumber });

        const pairText = `
*PAIRING CODE:* \`${code}\`

🔗 *Instructions:*
1. Open WhatsApp on your phone.
2. Tap *Menu* > *Linked Devices*.
3. Tap *Link a Device*.
4. Tap *Link with phone number instead*.
5. Enter: *${code}*
6. ✅ You're done!

Need a new code? Use \`/delpair ${phoneNumber}\` then request again.

_— Gabimaru WA Bot_ 🐉
        `.trim();
        bot.sendMessage(telegramChatId, pairText, { parse_mode: 'Markdown' });
        console.log(`[${phoneNumber}] Pairing Code Sent: ${code}`);
      }, 3000);
    }
  }

  sock.public = true;

  sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      await saveCreds();
      sessionStore.add(telegramChatId, phoneNumber);
      onStatus(`✅ Connected to ${phoneNumber}`);
    } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
      onStatus(`🔄 Reconnecting to ${phoneNumber}...`);
      startSession(phoneNumber, telegramChatId, onStatus, onMessage);
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages }) => {
    if (!messages[0]?.message) return;
    const msg = messages[0];
    if (onMessage) onMessage(sock, msg);
  });

  return sock;
}

module.exports = { startSession };