/**
 * MONTRAX PROFESSIONAL BOT v3.2
 */

import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { logger } from './utils/logger.js';
import {
  initializeDatabase, upsertUser, addAdminId, removeAdminId,
  setRequiredChannel, setRequiredGroup, clearRequiredChannel,
  clearRequiredGroup, getUser, getRequiredChannel, getRequiredGroup,
  getUserOrders, getAdminsFromDb, getAllUsers,
} from './services/database.js';

import checkSubscription from './middlewares/subscription.js';
import {
  isAdmin, isOwner, handleAdminPanel, handleStats, handleUsersList,
  handleUserDetails, handleOrdersList, handleOrderDetail, handleOrderAction,
  handlePaymentsList, handleBanUser, handleUnbanUser, handleBroadcast,
  handleSettings,
} from './handlers/admin.js';
import { handleServiceSelection } from './handlers/services.js';
import {
  handleShopMenu, handleStarsShop, handlePremiumShop, handleGiftShop,
  handleStarsOrder, handleGiftPurchase, handleSuccessfulPayment,
  handlePremiumOrder, adminGivePremium, adminGiveStars,
} from './handlers/shop.js';
import { handleReferralInfo, processReferral } from './handlers/referral.js';
import { handleMyProfile, handleMyOrders } from './handlers/profile.js';
import { handleTextMessage } from './handlers/textHandler.js';
import { getMainKeyboard, getLanguageKeyboard } from './keyboards/index.js';
import { getText } from './locales/index.js';

dotenv.config();

// ─── ADMIN IDs ────────────────────────────────────────────────────────────────

const ADMIN_IDS = [
  Number(process.env.OWNER_ID        || 0),
  Number(process.env.ADMIN_ID        || 0),
  Number(process.env.SECOND_ADMIN_ID || 0),
].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);

// ─── DATABASE ─────────────────────────────────────────────────────────────────

try {
  initializeDatabase();
  const ch = getRequiredChannel();
  const gr = getRequiredGroup();
  if (ch) logger.info('✅ Required channel:', ch);
  if (gr) logger.info('✅ Required group:', gr);
} catch (err) {
  logger.error('Database ishga tushmadi:', err);
  process.exit(1);
}

// ─── BOT ──────────────────────────────────────────────────────────────────────

if (!process.env.BOT_TOKEN) {
  logger.error('BOT_TOKEN topilmadi! .env faylini tekshiring.');
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

// ─── BOT COMMANDS — "/" bosganda Telegramda ko'rinadigan menyu ───────────────

bot.telegram.setMyCommands([
  { command: 'start', description: '🏠 Botni boshlash / Запустить бота / Start bot' },
  { command: 'menu',  description: '📋 Asosiy menyu / Главное меню / Main menu'     },
  { command: 'help',  description: '❓ Yordam / Помощь / Help'                       },
]).catch(() => {});

// ─── SESSION (SQLite — restart bo'lsa ham saqlanadi) ─────────────────────────

const DATA_DIR = process.env.DATA_DIR || './data';
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const sessionDb = new Database(path.join(DATA_DIR, 'sessions.db'));
sessionDb.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id      TEXT PRIMARY KEY,
    data    TEXT NOT NULL,
    updated INTEGER NOT NULL
  )
`);

const getSessionStmt = sessionDb.prepare('SELECT data FROM sessions WHERE id = ?');
const setSessionStmt = sessionDb.prepare('INSERT OR REPLACE INTO sessions (id, data, updated) VALUES (?, ?, ?)');

function defaultSession() {
  return {
    language:        'uz',
    step:            0,
    category:        null,
    description:     null,
    budget:          null,
    broadcastMode:   false,
    banMode:         null,
    addChannelMode:  false,
    addGroupMode:    false,
    addAdminMode:    false,
    removeAdminMode: false,
    searchMode:      null,
  };
}

bot.use(async (ctx, next) => {
  const key = ctx.from ? `user:${ctx.from.id}` : null;
  if (!key) return next();

  try {
    const row = getSessionStmt.get(key);
    ctx.session = row ? { ...defaultSession(), ...JSON.parse(row.data) } : defaultSession();
  } catch {
    ctx.session = defaultSession();
  }

  await next();

  try {
    setSessionStmt.run(key, JSON.stringify(ctx.session), Date.now());
  } catch (e) {
    logger.warn('Session save error:', e.message);
  }
});

// ─── USER UPSERT ──────────────────────────────────────────────────────────────

bot.use(async (ctx, next) => {
  if (ctx.from) {
    try {
      upsertUser(ctx.from.id, {
        username:   ctx.from.username,
        first_name: ctx.from.first_name,
        language:   ctx.session?.language || 'uz',
      });
    } catch (e) {
      logger.warn('User upsert error:', e.message);
    }
  }
  return next();
});

// ─── SUBSCRIPTION ─────────────────────────────────────────────────────────────

bot.use(checkSubscription);

// ─── COMMANDS ─────────────────────────────────────────────────────────────────

bot.start(async (ctx) => {
  try {
    const startParam = ctx.startPayload;
    if (startParam?.startsWith('ref_')) {
      await processReferral(ctx, startParam.replace('ref_', ''));
    }
    // Til tanlash yo'q — to'g'ridan menyu
    const lang = ctx.session?.language || 'uz';
    const name = ctx.from.first_name ? `, ${ctx.from.first_name}` : '';
    await ctx.reply(
      `Salom${name}! 👋\n\n${getText(lang, 'greeting')}`,
      getMainKeyboard(lang)
    );
    logger.info(`User ${ctx.from.id} /start, lang: ${lang}`);
  } catch (err) {
    logger.error(`/start error: ${err.message}`);
  }
});

bot.command('menu', async (ctx) => {
  const lang = ctx.session?.language || 'uz';
  await ctx.reply(getText(lang, 'greeting'), getMainKeyboard(lang));
});

bot.command('help', async (ctx) => {
  const lang = ctx.session?.language || 'uz';
  await ctx.reply(
    getText(lang, 'help_text', { contact: process.env.CONTACT_USERNAME || 'MONTRAX_offical' }),
    { parse_mode: 'Markdown' }
  );
});

bot.command('admin', async (ctx) => {
  try {
    if (!isAdmin(ctx.from.id)) return ctx.reply(getText(ctx.session?.language || 'uz', 'no_permission'));
    return handleAdminPanel(ctx);
  } catch (err) {
    logger.error(`/admin error: ${err.message}`);
    ctx.reply(getText(ctx.session?.language || 'uz', 'error')).catch(() => {});
  }
});

bot.command('stats', async (ctx) => {
  try {
    if (!isAdmin(ctx.from.id)) return ctx.reply(getText(ctx.session?.language || 'uz', 'no_permission'));
    return handleStats(ctx);
  } catch (err) {
    logger.error(`/stats error: ${err.message}`);
    ctx.reply(getText(ctx.session?.language || 'uz', 'error')).catch(() => {});
  }
});

bot.command('addadmin', async (ctx) => {
  try {
    const lang = ctx.session?.language || 'uz';
    if (!isOwner(ctx.from.id)) return ctx.reply(getText(lang, 'only_owner'));
    const id = Number(ctx.message.text.split(' ')[1]);
    if (!id) return ctx.reply(getText(lang, 'usage_addadmin'));
    addAdminId(id, ctx.from.id);
    ctx.reply(getText(lang, 'admin_added', { id }));
  } catch (err) {
    logger.error(`/addadmin error: ${err.message}`);
    ctx.reply(getText(ctx.session?.language || 'uz', 'error')).catch(() => {});
  }
});

bot.command('removeadmin', async (ctx) => {
  try {
    const lang = ctx.session?.language || 'uz';
    if (!isOwner(ctx.from.id)) return ctx.reply(getText(lang, 'only_owner'));
    const id = Number(ctx.message.text.split(' ')[1]);
    if (!id) return ctx.reply(getText(lang, 'usage_removeadmin'));
    removeAdminId(id);
    ctx.reply(getText(lang, 'admin_removed', { id }));
  } catch (err) {
    logger.error(`/removeadmin error: ${err.message}`);
    ctx.reply(getText(ctx.session?.language || 'uz', 'error')).catch(() => {});
  }
});

bot.command('setchannel', async (ctx) => {
  try {
    const lang = ctx.session?.language || 'uz';
    if (!isOwner(ctx.from.id)) return ctx.reply(getText(lang, 'only_owner'));
    const ch = ctx.message.text.split(' ')[1];
    if (!ch) return ctx.reply(getText(lang, 'usage_setchannel'));
    setRequiredChannel(ch);
    ctx.reply(getText(lang, 'channel_set', { channel: ch }));
  } catch (err) {
    logger.error(`/setchannel error: ${err.message}`);
    ctx.reply(getText(ctx.session?.language || 'uz', 'error')).catch(() => {});
  }
});

bot.command('removechannel', async (ctx) => {
  const lang = ctx.session?.language || 'uz';
  if (!isOwner(ctx.from.id)) return ctx.reply(getText(lang, 'only_owner'));
  clearRequiredChannel();
  ctx.reply(getText(lang, 'channel_removed'));
});

bot.command('setgroup', async (ctx) => {
  try {
    const lang = ctx.session?.language || 'uz';
    if (!isOwner(ctx.from.id)) return ctx.reply(getText(lang, 'only_owner'));
    const gr = ctx.message.text.split(' ')[1];
    if (!gr) return ctx.reply(getText(lang, 'usage_setgroup'));
    setRequiredGroup(gr);
    ctx.reply(getText(lang, 'group_set', { group: gr }));
  } catch (err) {
    logger.error(`/setgroup error: ${err.message}`);
    ctx.reply(getText(ctx.session?.language || 'uz', 'error')).catch(() => {});
  }
});

bot.command('removegroup', async (ctx) => {
  const lang = ctx.session?.language || 'uz';
  if (!isOwner(ctx.from.id)) return ctx.reply(getText(lang, 'only_owner'));
  clearRequiredGroup();
  ctx.reply(getText(lang, 'group_removed'));
});

bot.command('givepremium', async (ctx) => {
  try {
    const lang = ctx.session?.language || 'uz';
    if (!isAdmin(ctx.from.id)) return ctx.reply(getText(lang, 'no_permission'));
    const parts  = ctx.message.text.split(' ');
    const uid    = Number(parts[1]);
    const months = Number(parts[2]) || 1;
    if (!uid) return ctx.reply(getText(lang, 'usage_givepremium'));
    await adminGivePremium(ctx, uid, months);
    ctx.reply(getText(lang, 'premium_given', { id: uid, months }));
  } catch (err) {
    logger.error(`/givepremium error: ${err.message}`);
    ctx.reply(getText(ctx.session?.language || 'uz', 'error')).catch(() => {});
  }
});

bot.command('givestars', async (ctx) => {
  try {
    const lang = ctx.session?.language || 'uz';
    if (!isAdmin(ctx.from.id)) return ctx.reply(getText(lang, 'no_permission'));
    const parts  = ctx.message.text.split(' ');
    const uid    = Number(parts[1]);
    const amount = Number(parts[2]) || 0;
    if (!uid || !amount) return ctx.reply(getText(lang, 'usage_givestars'));
    await adminGiveStars(ctx, uid, amount);
    ctx.reply(getText(lang, 'stars_given', { id: uid, amount }));
  } catch (err) {
    logger.error(`/givestars error: ${err.message}`);
    ctx.reply(getText(ctx.session?.language || 'uz', 'error')).catch(() => {});
  }
});

// ─── CALLBACKS ────────────────────────────────────────────────────────────────

// Til tanlash
bot.action(/^lang:(.+)$/, async (ctx) => {
  const newLang = ctx.match[1];
  // lang:change ni qayta ishlamasin
  if (newLang === 'change') {
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      '🌐 Tilni tanlang / Выберите язык / Choose language:',
      getLanguageKeyboard()
    ).catch(() => ctx.reply('🌐 Tilni tanlang / Выберите язык / Choose language:', getLanguageKeyboard()));
    return;
  }
  ctx.session.language = newLang;
  await ctx.answerCbQuery(`✅ ${newLang.toUpperCase()} tanlandi`);
  await ctx.editMessageText(getText(newLang, 'greeting'), getMainKeyboard(newLang))
    .catch(() => ctx.reply(getText(newLang, 'greeting'), getMainKeyboard(newLang)));
});

bot.action('menu:main', async (ctx) => {
  const lang = ctx.session?.language || 'uz';
  await ctx.answerCbQuery();
  await ctx.editMessageText(getText(lang, 'greeting'), getMainKeyboard(lang))
    .catch(() => ctx.reply(getText(lang, 'greeting'), getMainKeyboard(lang)));
});

bot.action('check_sub', checkSubscription, async (ctx) => {
  const lang = ctx.session?.language || 'uz';
  await ctx.editMessageText(getText(lang, 'greeting'), getMainKeyboard(lang))
    .catch(() => ctx.reply(getText(lang, 'subscription_check')));
  await ctx.answerCbQuery(getText(lang, 'subscription_check'));
});

// Xizmat
bot.action(/^cat:(.+)$/, (ctx) => handleServiceSelection(ctx));

// Do'kon
bot.action('shop:menu',    (ctx) => handleShopMenu(ctx));
bot.action('shop:stars',   (ctx) => handleStarsShop(ctx));
bot.action('shop:premium', (ctx) => handlePremiumShop(ctx));
bot.action('shop:gift',    (ctx) => handleGiftShop(ctx));
bot.action(/^stars:buy:(.+)$/,   (ctx) => handleStarsOrder(ctx));
bot.action(/^gift:(\d+)$/,       (ctx) => handleGiftPurchase(ctx));
bot.action(/^premium:buy:(.+)$/, (ctx) => handlePremiumOrder(ctx));

// Profil
bot.action('my:profile', (ctx) => handleMyProfile(ctx));
bot.action('my:orders',  (ctx) => handleMyOrders(ctx));

// Referral
bot.action('referral:info', (ctx) => handleReferralInfo(ctx));

// Admin
bot.action('admin:menu',           (ctx) => handleAdminPanel(ctx));
bot.action('admin:stats',          (ctx) => handleStats(ctx));
bot.action('admin:users',          (ctx) => handleUsersList(ctx, 0));
bot.action(/^admin:users:page:(\d+)$/, (ctx) => handleUsersList(ctx, parseInt(ctx.match[1], 10)));
bot.action('admin:orders',         (ctx) => handleOrdersList(ctx));
bot.action('admin:orders:pending', (ctx) => handleOrdersList(ctx, 'pending'));
bot.action('admin:orders:done',    (ctx) => handleOrdersList(ctx, 'done'));
bot.action('admin:payments',       (ctx) => handlePaymentsList(ctx));
bot.action('admin:broadcast',      (ctx) => handleBroadcast(ctx));
bot.action('admin:settings',       (ctx) => handleSettings(ctx));

bot.action(/^admin:user:(\d+)$/,  (ctx) => handleUserDetails(ctx, Number(ctx.match[1])));
bot.action(/^admin:ban:(\d+)$/,   (ctx) => handleBanUser(ctx, Number(ctx.match[1])));
bot.action(/^admin:unban:(\d+)$/, (ctx) => handleUnbanUser(ctx, Number(ctx.match[1])));

bot.action('admin:users:search', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  ctx.session.searchMode = 'user';
  await ctx.reply(getText(ctx.session?.language || 'uz', 'prompt_search_user'));
});

bot.action(/^admin:userorders:(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const orders = getUserOrders(Number(ctx.match[1]));
  let text = `📦 *Foydalanuvchi buyurtmalari*\n\n`;
  if (!orders.length) text += 'Buyurtmalar yo\'q';
  orders.forEach(o => { text += `#${o.id} | ${o.category} | ${o.status} | ${o.budget}\n`; });
  await ctx.editMessageText(text, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [[{ text: '← Orqaga', callback_data: 'admin:users' }]] },
  }).catch(() => ctx.reply(text));
});

bot.action(/^order:(confirm|reject|done):(\d+)$/, (ctx) =>
  handleOrderAction(ctx, ctx.match[1], Number(ctx.match[2]), bot, {})
);
bot.action(/^order:detail:(\d+)$/, (ctx) => handleOrderDetail(ctx, Number(ctx.match[1])));

// Sozlamalar
bot.action('settings:add_channel', async (ctx) => {
  if (!isOwner(ctx.from.id)) return ctx.answerCbQuery('❌');
  await ctx.answerCbQuery().catch(() => {});
  ctx.session.addChannelMode = true;
  await ctx.reply(getText(ctx.session?.language || 'uz', 'enter_channel'));
});
bot.action('settings:remove_channel', async (ctx) => {
  if (!isOwner(ctx.from.id)) return ctx.answerCbQuery('❌');
  await ctx.answerCbQuery().catch(() => {});
  clearRequiredChannel();
  await ctx.reply(getText(ctx.session?.language || 'uz', 'channel_removed'));
});
bot.action('settings:add_group', async (ctx) => {
  if (!isOwner(ctx.from.id)) return ctx.answerCbQuery('❌');
  await ctx.answerCbQuery().catch(() => {});
  ctx.session.addGroupMode = true;
  await ctx.reply(getText(ctx.session?.language || 'uz', 'enter_group'));
});
bot.action('settings:remove_group', async (ctx) => {
  if (!isOwner(ctx.from.id)) return ctx.answerCbQuery('❌');
  await ctx.answerCbQuery().catch(() => {});
  clearRequiredGroup();
  await ctx.reply(getText(ctx.session?.language || 'uz', 'group_removed'));
});
bot.action('settings:add_admin', async (ctx) => {
  if (!isOwner(ctx.from.id)) return ctx.answerCbQuery('❌');
  await ctx.answerCbQuery().catch(() => {});
  ctx.session.addAdminMode = true;
  await ctx.reply(getText(ctx.session?.language || 'uz', 'enter_addadmin'));
});
bot.action('settings:remove_admin', async (ctx) => {
  if (!isOwner(ctx.from.id)) return ctx.answerCbQuery('❌');
  await ctx.answerCbQuery().catch(() => {});
  ctx.session.removeAdminMode = true;
  const admins = getAdminsFromDb();
  await ctx.reply(
    getText(ctx.session?.language || 'uz', 'enter_removeadmin') +
    '\n\n' + (admins.join('\n') || 'Bo\'sh')
  );
});

// ─── TEXT HANDLER ─────────────────────────────────────────────────────────────

bot.on('text', async (ctx) => {
  await handleTextMessage(ctx, bot, ADMIN_IDS);
});

// ─── PAYMENT ──────────────────────────────────────────────────────────────────

bot.on('pre_checkout_query', (ctx) => ctx.answerPreCheckoutQuery(true));
bot.on('successful_payment', (ctx) => handleSuccessfulPayment(ctx, ADMIN_IDS));

// ─── ERROR ────────────────────────────────────────────────────────────────────

bot.catch((err, ctx) => {
  logger.error(`Bot error [user: ${ctx.from?.id}]: ${err.message}`);
  ctx.reply(getText(ctx.session?.language || 'uz', 'error')).catch(() => {});
});

// ─── LAUNCH ───────────────────────────────────────────────────────────────────

bot.launch({
  polling: {
    timeout:        30,
    limit:          100,
    allowedUpdates: ['message', 'callback_query', 'pre_checkout_query', 'inline_query'],
  },
}).then(async () => {
  const info = await bot.telegram.getMe();
  logger.info(`🤖 MONTRAX BOT v3.2 ishlamoqda! @${info.username}`);
  logger.info(`Admin IDs: ${ADMIN_IDS.join(', ')}`);
}).catch((err) => {
  logger.error('Bot ishga tushmadi:', err);
  process.exit(1);
});

process.once('SIGINT',  () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

export default bot;