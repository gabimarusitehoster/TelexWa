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

bot.onText(/\/start/, async (msg, match) => {
  const chatId = msg.chat.id;
  const phoneNumber = match[1];

  const follows = await userFollowsChannel(chatId);
  if (!follows) {
    return bot.sendMessage(chatId, `🚫 Please follow ${CHANNEL_USERNAME} to use this bot.`);
  }
  return bot.sendMessage(chatId, `Viper X Menu\n\n¢ /startpair\n¢ /list\n¢ /delpair`);
});

bot.onText(/\/startpair (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const phoneNumber = match[1];

  const follows = await userFollowsChannel(chatId);
  if (!follows) {
    return bot.sendMessage(chatId, `🚫 Please follow ${CHANNEL_USERNAME} to use this bot.`);
  }

  const status = (text) =>
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });

  const onMessage = (conn, waMsg) => {
    console.log(`[WA:${phoneNumber}]`, waMsg);
  };

  await startSession(phoneNumber, chatId, status, onMessage);
});

bot.onText(/\/delpair (\d+)/, async (msg, match) => {
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

bot.onText(/\/list/, async (msg) => {
  const chatId = msg.chat.id;

  const follows = await userFollowsChannel(chatId);
  if (!follows) {
    return bot.sendMessage(chatId, `🚫 Please follow ${CHANNEL_USERNAME} to use this bot.`);
  }

  const list = sessionStore.list(chatId);
  if (!list.length) return bot.sendMessage(chatId, `No sessions found.`);

  let text = '📱 Your sessions:\n\n' + list.map(u => `${u.phoneNumber} (Uptime: ${Math.floor((Date.now() - u.connectedAt) / 1000)}s)`).join('\n');
  bot.sendMessage(chatId, text);
});

console.log("✅ Telegram bot running...");

module.exports = { bot };