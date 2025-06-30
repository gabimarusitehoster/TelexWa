
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const { startSession } = require('./whatsappManager');
const sessionStore = require('./sessionStore');
const config = require('./config.json');

const bot = new TelegramBot(config.BOT_TOKEN, { polling: true });

const CHANNEL_USERNAME = '@gabimarutechchannel'; 

async function userFollowsChannel(userId) {
  try {
    const res = await bot.getChatMember(CHANNEL_USERNAME, userId);
    const validStatuses = ['member', 'administrator', 'creator'];
    return validStatuses.includes(res.status);
  } catch (err) {
    console.error(`Error checking membership for ${userId} in ${CHANNEL_USERNAME}:`, err.message);
    return false;
  }
}

bot.onText(/\/startpair (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const phoneNumber = match[1];

  if (!userFollowsChannel(chatId)) {
    return bot.sendMessage(chatId, 'Please follow the required channel.');
  }

  const status = (text) => bot.sendMessage(chatId, text);
  const onMessage = (conn, msg) => {
    console.log(`[WA:${phoneNumber}]`, msg);
  };

  await startSession(phoneNumber, chatId, status, onMessage);
});

bot.onText(/\/delpair (\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const phoneNumber = match[1];
  const sessionPath = path.join(__dirname, 'tmp', `session_${phoneNumber}`);

  if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true, force: true });
    sessionStore.remove(chatId, phoneNumber);
    bot.sendMessage(chatId, `🗑 Session ${phoneNumber} deleted.`);
  } else {
    bot.sendMessage(chatId, `⚠️ Session not found.`);
  }
});

bot.onText(/\/list/, (msg) => {
  const chatId = msg.chat.id;
  const list = sessionStore.list(chatId);
  if (!list.length) return bot.sendMessage(chatId, `No sessions found.`);
  let text = '📱 Your sessions:\n\n' + list.map(u => `${u.phoneNumber} (Uptime: ${Math.floor((Date.now() - u.connectedAt) / 1000)}s)`).join('\n');
  bot.sendMessage(chatId, text);
});

console.log("✅ Telegram bot running...");