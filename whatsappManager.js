
const {
  makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion, DisconnectReason, Browsers
} = require("@adiwajshing/baileys");
const pino = require("pino");
const fs = require("fs");
const path = require("path");
const sessionStore = require("./sessionStore");

async function startSession(phoneNumber, telegramChatId, onStatus, onMessage) {
  const sessionPath = path.join(__dirname, "tmp", `session_${phoneNumber}`);
  if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    browser: Browsers.macOS("Viper MultiHost"),
    logger: pino({ level: "silent" }),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }))
    }
  });

  sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      await saveCreds();
      sessionStore.add(telegramChatId, phoneNumber);
      onStatus(`✅ Connected to ${phoneNumber}`);
    } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
      onStatus(`🔄 Reconnecting ${phoneNumber}...`);
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