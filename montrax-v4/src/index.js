/**
 * MONTRAX PROFESSIONAL BOT v3.0
 */

import { Telegraf, session } from 'telegraf';
import dotenv from 'dotenv';
import { logger } from './utils/logger.js';
import { initializeDatabase, upsertUser, addAdminId, removeAdminId,
         setRequiredChannel, setRequiredGroup, clearRequiredChannel,
         clearRequiredGroup, getUser, getRequiredChannel, getRequiredGroup,
         getUserOrders, getAdminsFromDb, banUser, getAllUsers } from './services/database.js';

import checkSubscription from './middlewares/subscription.js';
import { isAdmin, isOwner, handleAdminPanel, handleStats, handleUsersList,
         handleUserDetails, handleOrdersList, handleOrderDetail, handleOrderAction,
         handlePaymentsList, handleBanUser, handleUnbanUser, handleBroadcast,
         sendBroadcastMessage, handleSettings } from './handlers/admin.js';
import { handleServiceSelection, handleServiceDescription,
         handleServiceBudget, handleServiceAdditional } from './handlers/services.js';
import { handleShopMenu, handleStarsShop, handlePremiumShop, handleGiftShop,
         handleStarsOrder, handleGiftPurchase, handleSuccessfulPayment,
         handlePremiumOrder, adminGivePremium, adminGiveStars } from './handlers/shop.js';
import { handleReferralInfo, processReferral } from './handlers/referral.js';
import { handleMyProfile, handleMyOrders } from './handlers/profile.js';
import { handleTextMessage } from './handlers/textHandler.js';
import { getMainKeyboard, getLanguageKeyboard } from './keyboards/index.js';
import { getText } from './locales/index.js';

dotenv.config();

// ─── ADMIN IDs ───────────────────────────────────────────────────────────────

const ADMIN_IDS = [
  Number(process.env.OWNER_ID        || 0),
  Number(process.env.ADMIN_ID        || 0),
  Number(process.env.SECOND_ADMIN_ID || 0),
].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);

// ─── DATABASE ─────────────────────────────────────────────────────────────────

try {
  initializeDatabase();
  // Show configured channel/group so owner can verify
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

// ─── SESSION ──────────────────────────────────────────────────────────────────

bot.use(session({
  defaultSession: () => ({
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
    givePremiumMode: null,
  }),
}));

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
    const name = ctx.from.first_name ? `, ${ctx.from.first_name}` : '';
    await ctx.reply(
      `Salom${name}! 👋\n\nTilni tanlang / Выберите язык / Choose language:`,
      getLanguageKeyboard()
    );
    logger.info(`User ${ctx.from.id} started bot`);
  } catch (err) {
    logger.error(`/start error: ${err.message}`);
  }
});

bot.command('menu', async (ctx) => {
  const lang = ctx.session?.language || 'uz';
  await ctx.reply(getText(lang, 'greeting'), getMainKeyboard(lang));
});

bot.command('admin', async (ctx) => {
  try {
    const userId = ctx.from.id;
    if (!isAdmin(userId)) {
      logger.warn(`/admin denied for user ${userId}`);
      const lang = ctx.session?.language || 'uz';
      return ctx.reply(getText(lang, 'no_permission'));
    }
    return handleAdminPanel(ctx);
  } catch (err) {
    logger.error(`/admin error: ${err.message}`);
    const lang = ctx.session?.language || 'uz';
    ctx.reply(getText(lang, 'error')).catch(() => {});
  }
});

bot.command('stats', async (ctx) => {
  try {
    if (!isAdmin(ctx.from.id)) {
      const lang = ctx.session?.language || 'uz';
      return ctx.reply(getText(lang, 'no_permission'));
    }
    return handleStats(ctx);
  } catch (err) {
    logger.error(`/stats error: ${err.message}`);
    const lang = ctx.session?.language || 'uz';
    ctx.reply(getText(lang, 'error')).catch(() => {});
  }
});

bot.command('help', async (ctx) => {
  const lang = ctx.session?.language || 'uz';
  await ctx.reply(
    getText(lang, 'help_text', { contact: process.env.CONTACT_USERNAME || 'MONTRAX_offical' }),
    { parse_mode: 'Markdown' }
  );
});

// Faqat Owner buyruqlari
bot.command('addadmin', async (ctx) => {
  try {
    if (!isOwner(ctx.from.id)) {
      const lang = ctx.session?.language || 'uz';
      return ctx.reply(getText(lang, 'only_owner'));
    }
    const id = Number(ctx.message.text.split(' ')[1]);
    if (!id) {
      const lang = ctx.session?.language || 'uz';
      return ctx.reply(getText(lang, 'usage_addadmin'));
    }
    addAdminId(id, ctx.from.id);
    const lang = ctx.session?.language || 'uz';
    ctx.reply(getText(lang, 'admin_added', { id }));
  } catch (err) {
    logger.error(`/addadmin error: ${err.message}`);
    const lang = ctx.session?.language || 'uz';
    ctx.reply(getText(lang, 'error')).catch(() => {});
  }
});

bot.command('removeadmin', async (ctx) => {
  try {
    if (!isOwner(ctx.from.id)) {
      const lang = ctx.session?.language || 'uz';
      return ctx.reply(getText(lang, 'only_owner'));
    }
    const id = Number(ctx.message.text.split(' ')[1]);
    if (!id) {
      const lang = ctx.session?.language || 'uz';
      return ctx.reply(getText(lang, 'usage_removeadmin'));
    }
    removeAdminId(id);
    const lang = ctx.session?.language || 'uz';
    ctx.reply(getText(lang, 'admin_removed', { id }));
  } catch (err) {
    logger.error(`/removeadmin error: ${err.message}`);
    const lang = ctx.session?.language || 'uz';
    ctx.reply(getText(lang, 'error')).catch(() => {});
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
    const lang = ctx.session?.language || 'uz';
    ctx.reply(getText(lang, 'error')).catch(() => {});
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
    const lang = ctx.session?.language || 'uz';
    ctx.reply(getText(lang, 'error')).catch(() => {});
  }
});

bot.command('removegroup', async (ctx) => {
  const lang = ctx.session?.language || 'uz';
  if (!isOwner(ctx.from.id)) return ctx.reply(getText(lang, 'only_owner'));
  clearRequiredGroup();
  ctx.reply(getText(lang, 'group_removed'));
});

// Premium berish (admin)
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
    const lang = ctx.session?.language || 'uz';
    ctx.reply(getText(lang, 'error')).catch(() => {});
  }
});

// Stars berish (admin - to'lov qilgandan keyin)
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
    const lang = ctx.session?.language || 'uz';
    ctx.reply(getText(lang, 'error')).catch(() => {});
  }
});

// ─── CALLBACKS ────────────────────────────────────────────────────────────────

bot.action(/^lang:(.+)$/, async (ctx) => {
  ctx.session.language = ctx.match[1];
  const lang = ctx.session.language;
  await ctx.editMessageText(getText(lang, 'greeting'), getMainKeyboard(lang));
  await ctx.answerCbQuery();
});

bot.action('menu:main', async (ctx) => {
  const lang = ctx.session?.language || 'uz';
  await ctx.editMessageText(getText(lang, 'greeting'), getMainKeyboard(lang))
    .catch(() => ctx.reply(getText(lang, 'greeting'), getMainKeyboard(lang)));
  await ctx.answerCbQuery();
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
bot.action(/^stars:buy:(.+)$/,    (ctx) => handleStarsOrder(ctx));
bot.action(/^gift:(\d+)$/,        (ctx) => handleGiftPurchase(ctx));
bot.action(/^premium:buy:(.+)$/,  (ctx) => handlePremiumOrder(ctx));

// Profil
bot.action('my:profile', (ctx) => handleMyProfile(ctx));
bot.action('my:orders',  (ctx) => handleMyOrders(ctx));

// Referral
bot.action('referral:info', (ctx) => handleReferralInfo(ctx));

// Admin
bot.action('admin:menu',           (ctx) => handleAdminPanel(ctx));
bot.action('admin:stats',          (ctx) => handleStats(ctx));
bot.action('admin:users',          (ctx) => handleUsersList(ctx));
bot.action('admin:orders',         (ctx) => handleOrdersList(ctx));
bot.action('admin:orders:pending', (ctx) => handleOrdersList(ctx, 'pending'));
bot.action('admin:orders:done',    (ctx) => handleOrdersList(ctx, 'done'));
bot.action('admin:payments',       (ctx) => handlePaymentsList(ctx));
bot.action('admin:broadcast',      (ctx) => handleBroadcast(ctx));
bot.action('admin:settings',       (ctx) => handleSettings(ctx));

bot.action(/^admin:user:(\d+)$/,   (ctx) => handleUserDetails(ctx, Number(ctx.match[1])));
bot.action(/^admin:ban:(\d+)$/,    (ctx) => handleBanUser(ctx, Number(ctx.match[1])));
bot.action(/^admin:unban:(\d+)$/,  (ctx) => handleUnbanUser(ctx, Number(ctx.match[1])));

bot.action('admin:users:search', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  ctx.session.searchMode = 'user';
  const lang = ctx.session?.language || 'uz';
  await ctx.reply(getText(lang, 'prompt_search_user'));
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
  const lang = ctx.session?.language || 'uz';
  await ctx.reply(getText(lang, 'enter_channel'));
});
bot.action('settings:remove_channel', async (ctx) => {
  if (!isOwner(ctx.from.id)) return ctx.answerCbQuery('❌');
  await ctx.answerCbQuery().catch(() => {});
  clearRequiredChannel();
  const lang = ctx.session?.language || 'uz';
  await ctx.reply(getText(lang, 'channel_removed'));
});
bot.action('settings:add_group', async (ctx) => {
  if (!isOwner(ctx.from.id)) return ctx.answerCbQuery('❌');
  await ctx.answerCbQuery().catch(() => {});
  ctx.session.addGroupMode = true;
  const lang = ctx.session?.language || 'uz';
  await ctx.reply(getText(lang, 'enter_group'));
});
bot.action('settings:remove_group', async (ctx) => {
  if (!isOwner(ctx.from.id)) return ctx.answerCbQuery('❌');
  await ctx.answerCbQuery().catch(() => {});
  clearRequiredGroup();
  const lang = ctx.session?.language || 'uz';
  await ctx.reply(getText(lang, 'group_removed'));
});
bot.action('settings:add_admin', async (ctx) => {
  if (!isOwner(ctx.from.id)) return ctx.answerCbQuery('❌');
  await ctx.answerCbQuery().catch(() => {});
  ctx.session.addAdminMode = true;
  const lang = ctx.session?.language || 'uz';
  await ctx.reply(getText(lang, 'enter_addadmin'));
});
bot.action('settings:remove_admin', async (ctx) => {
  if (!isOwner(ctx.from.id)) return ctx.answerCbQuery('❌');
  await ctx.answerCbQuery().catch(() => {});
  ctx.session.removeAdminMode = true;
  const admins = getAdminsFromDb();
  const lang = ctx.session?.language || 'uz';
  await ctx.reply(getText(lang, 'enter_removeadmin') + '\n\n' + (admins.join('\n') || 'Bo\'sh'));
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
  const lang = ctx.session?.language || 'uz';
  ctx.reply(getText(lang, 'error')).catch(() => {});
});

// ─── LAUNCH ───────────────────────────────────────────────────────────────────

bot.launch({
  polling: {
    timeout:        30,
    limit:          100,
    allowedUpdates: ['message', 'callback_query', 'pre_checkout_query'],
  },
}).then(async () => {
  const info = await bot.telegram.getMe();
  logger.info(`🤖 MONTRAX BOT v3.0 ishlamoqda! @${info.username}`);
  logger.info(`Admin IDs: ${ADMIN_IDS.join(', ')}`);
}).catch((err) => {
  logger.error('Bot ishga tushmadi:', err);
  process.exit(1);
});

process.once('SIGINT',  () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

export default bot;
