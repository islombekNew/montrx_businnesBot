/**
 * Admin Panel - To'liq professional versiya
 * Ega (Owner) va Admin huquqlari alohida
 */

import { logger } from '../utils/logger.js';
import { escapeMarkdown } from '../utils/text.js';
import {
  getAllUsers, getStats, getUserFullHistory, getAdminsFromDb,
  addAdminId, removeAdminId, setRequiredChannel, setRequiredGroup,
  clearRequiredChannel, clearRequiredGroup, getRequiredChannel,
  getRequiredGroup, getSetting, setSetting, getAllOrders,
  updateOrderStatus, banUser, unbanUser, getOrderById, getUserOrders,
} from '../services/database.js';
import { getText } from '../locales/index.js';
import { getUser } from '../services/database.js';
import { getOrderStatusKeyboard } from '../keyboards/index.js';

export function isOwner(userId) {
  const OWNER = Number(process.env.OWNER_ID || 0);
  return userId === OWNER;
}

export function isAdmin(userId) {
  const IDS = [
    Number(process.env.OWNER_ID        || 0),
    Number(process.env.ADMIN_ID        || 0),
    Number(process.env.SECOND_ADMIN_ID || 0),
  ].filter(Boolean);
  if (IDS.includes(userId)) return true;
  return getAdminsFromDb().includes(userId);
}

function deny(ctx) {
  return ctx.reply('❌ Ruxsat yo\'q');
}

// ─── ADMIN PANEL ─────────────────────────────────────────────────────────────

export async function handleAdminPanel(ctx) {
  try {
    if (!isAdmin(ctx.from.id)) return deny(ctx);
    if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});

    const role    = isOwner(ctx.from.id) ? '👑 EGA' : '🔧 ADMIN';
    const stats   = getStats();

    const text =
      `${role} *ADMIN PANEL*\n\n` +
      `📊 Bugungi: +${stats.todayUsers} foydalanuvchi, +${stats.todayOrders} buyurtma\n` +
      `📦 Kutilmoqda: ${stats.pendingOrders} buyurtma\n\n` +
      `Amalni tanlang`;

  const keyboard = [
    [
      { text: '📊 Statistika',       callback_data: 'admin:stats'    },
      { text: '👥 Foydalanuvchilar', callback_data: 'admin:users'    },
    ],
    [
      { text: '📦 Buyurtmalar',      callback_data: 'admin:orders'   },
      { text: '💰 To\'lovlar',       callback_data: 'admin:payments' },
    ],
  ];

  if (isOwner(ctx.from.id)) {
    keyboard.push([
      { text: '📢 Broadcast',        callback_data: 'admin:broadcast' },
      { text: '⚙️ Sozlamalar',       callback_data: 'admin:settings'  },
    ]);
  }

  keyboard.push([{ text: '← Bosh menyu', callback_data: 'menu:main' }]);

  const opts = { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } };

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, opts).catch(() => ctx.reply(text, opts));
  } else {
    await ctx.reply(text, opts);
  }

    logger.info(`Admin ${ctx.from.id} opened admin panel`);
  } catch (err) {
    logger.error(`Admin panel error [user: ${ctx.from?.id}]: ${err.message}`);
    ctx.reply('❌ Xato yuz berdi').catch(() => {});
  }
}

// ─── STATISTIKA ──────────────────────────────────────────────────────────────

export async function handleStats(ctx) {
  if (!isAdmin(ctx.from.id)) return deny(ctx);
  if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});

  const s = getStats();
  const premiumPct = s.totalUsers ? ((s.premiumUsers / s.totalUsers) * 100).toFixed(1) : '0.0';

  const text =
    `📊 *STATISTIKA*\n\n` +
    `👥 Jami foydalanuvchilar: *${s.totalUsers}*\n` +
    `👑 Premium: *${s.premiumUsers}* (${premiumPct}%)\n` +
    `🚫 Banned: *${s.bannedUsers}*\n` +
    `📅 Bugun qo\'shilgan: *${s.todayUsers}*\n\n` +
    `📦 Jami buyurtmalar: *${s.totalOrders}*\n` +
    `⏳ Kutilmoqda: *${s.pendingOrders}*\n` +
    `✅ Bajarilgan: *${s.doneOrders}*\n` +
    `📅 Bugungi buyurtmalar: *${s.todayOrders}*\n\n` +
    `💰 Jami daromad: *${s.totalRevenue.toLocaleString()} Stars*`;

  const opts = {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [[{ text: '← Orqaga', callback_data: 'admin:menu' }]] },
  };

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, opts).catch(() => ctx.reply(text, opts));
  } else {
    await ctx.reply(text, opts);
  }
}

// ─── FOYDALANUVCHILAR ────────────────────────────────────────────────────────

const USERS_PER_PAGE = 15;

export async function handleUsersList(ctx, page = 0) {
  if (!isAdmin(ctx.from.id)) return deny(ctx);
  if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});

  const allUsers   = getAllUsers();
  const total      = allUsers.length;
  const totalPages = Math.ceil(total / USERS_PER_PAGE) || 1;
  const safePage   = Math.max(0, Math.min(page, totalPages - 1));
  const pageUsers  = allUsers.slice(safePage * USERS_PER_PAGE, (safePage + 1) * USERS_PER_PAGE);

  const text = `👥 *FOYDALANUVCHILAR*\n\nJami: *${total}* ta | Sahifa: ${safePage + 1}/${totalPages}`;

  const buttons = pageUsers.map(u => [{
    text: `${u.is_banned ? '🚫' : u.is_premium ? '👑' : '👤'} ${escapeMarkdown(u.first_name || u.username || 'NoName')} (${u.telegram_id})`,
    callback_data: `admin:user:${u.telegram_id}`,
  }]);

  const navRow = [];
  if (safePage > 0)              navRow.push({ text: '◀️ Oldingi', callback_data: `admin:users:page:${safePage - 1}` });
  if (safePage < totalPages - 1) navRow.push({ text: 'Keyingi ▶️', callback_data: `admin:users:page:${safePage + 1}` });
  if (navRow.length) buttons.push(navRow);

  buttons.push([{ text: '🔍 Qidirish', callback_data: 'admin:users:search' }]);
  buttons.push([{ text: '← Orqaga',    callback_data: 'admin:menu'         }]);

  const opts = { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } };

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, opts).catch(() => ctx.reply(text, opts));
  } else {
    await ctx.reply(text, opts);
  }
}

export async function handleUserDetails(ctx, telegramId) {
  if (!isAdmin(ctx.from.id)) return deny(ctx);
  if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});

  const history = getUserFullHistory(telegramId);
  if (!history) return ctx.reply('❌ Foydalanuvchi topilmadi');

  const { user, orders, payments } = history;
  const name = escapeMarkdown(`${user.first_name || ''} ${user.username ? '@' + user.username : ''}`.trim());

  let text =
    `👤 *FOYDALANUVCHI #${user.id}*\n\n` +
    `🆔 Telegram ID: \`${user.telegram_id}\`\n` +
    `📝 Ism: ${name || escapeMarkdown('Noma\'lum')}\n` +
    `🌐 Til: ${user.language?.toUpperCase()}\n` +
    `👑 Status: ${user.is_premium ? '✨ Premium' : '📱 Oddiy'}\n` +
    `🚫 Ban: ${user.is_banned ? `Ha (${escapeMarkdown(user.ban_reason || 'sabab yo\'q')})` : 'Yo\'q'}\n` +
    `⭐ Stars: ${user.stars_balance}\n` +
    `💰 Jami sarflagan: ${user.total_spent} Stars\n` +
    `👥 Referallar: ${user.referral_count}\n` +
    `📅 Qo\'shilgan: ${new Date(user.created_at).toLocaleDateString('uz-UZ')}\n\n` +
    `📦 Buyurtmalar: ${orders.length} ta\n` +
    `💳 To'lovlar: ${payments.length} ta`;

  const keyboard = [];

  if (user.is_banned) {
    keyboard.push([{ text: '✅ Unban',            callback_data: `admin:unban:${telegramId}` }]);
  } else {
    keyboard.push([{ text: '🚫 Ban',              callback_data: `admin:ban:${telegramId}` }]);
  }

  if (user.username) {
    keyboard.push([{ text: '💬 Yozish',           url: `https://t.me/${user.username}` }]);
  }

  keyboard.push([{ text: '📦 Buyurtmalari',     callback_data: `admin:userorders:${telegramId}` }]);
  keyboard.push([{ text: '← Orqaga',             callback_data: 'admin:users' }]);

  const opts = { parse_mode: 'Markdown', reply_markup: { inline_keyboard: keyboard } };

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, opts).catch(() => ctx.reply(text, opts));
  } else {
    await ctx.reply(text, opts);
  }

  logger.info(`Admin ${ctx.from.id} viewed user ${telegramId}`);
}

// ─── BUYURTMALAR ─────────────────────────────────────────────────────────────

export async function handleOrdersList(ctx, statusFilter = null) {
  if (!isAdmin(ctx.from.id)) return deny(ctx);
  if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});

  const orders = getAllOrders(statusFilter || 'pending').slice(0, 15);

  let text = `📦 *BUYURTMALAR*${statusFilter ? ` (${statusFilter})` : ' (kutilmoqda)'}\n\n`;

  if (!orders.length) {
    text += 'Buyurtmalar yo\'q';
  }

  const buttons = orders.map(o => [{
    text: `#${o.id} | ${escapeMarkdown(o.category)} | ${escapeMarkdown(o.first_name || o.username || o.telegram_id)} | ${escapeMarkdown(o.status)}`,
    callback_data: `order:detail:${o.id}`,
  }]);

  buttons.push([
    { text: '⏳ Pending',   callback_data: 'admin:orders:pending'   },
    { text: '✅ Done',      callback_data: 'admin:orders:done'      },
  ]);
  buttons.push([{ text: '← Orqaga', callback_data: 'admin:menu' }]);

  const opts = { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } };

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, opts).catch(() => ctx.reply(text, opts));
  } else {
    await ctx.reply(text, opts);
  }
}

export async function handleOrderDetail(ctx, orderId) {
  if (!isAdmin(ctx.from.id)) return deny(ctx);
  if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});

  const order = getOrderById(orderId);
  if (!order) return ctx.reply('Buyurtma topilmadi');

  const text =
    `📦 *BUYURTMA #${order.id}*\n\n` +
    `🏷️ Kategoriya: ${escapeMarkdown(order.category)}\n` +
    `📝 ${escapeMarkdown(order.description)}\n` +
    `💰 Byudjet: ${escapeMarkdown(order.budget)}\n` +
    `📊 Status: *${escapeMarkdown(order.status)}*\n` +
    `📅 Sana: ${new Date(order.created_at).toLocaleString('uz-UZ')}\n` +
    `${order.admin_note ? `\n🗒️ Izoh: ${escapeMarkdown(order.admin_note)}` : ''}`;

  const opts = { parse_mode: 'Markdown', ...getOrderStatusKeyboard(orderId) };

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, opts).catch(() => ctx.reply(text, opts));
  } else {
    await ctx.reply(text, opts);
  }
}

export async function handleOrderAction(ctx, action, orderId, bot, statusMap) {
  if (!isAdmin(ctx.from.id)) return deny(ctx);
  await ctx.answerCbQuery().catch(() => {});

  const statusMap2 = { confirm: 'confirmed', reject: 'rejected', done: 'done' };
  const newStatus  = statusMap2[action];
  if (!newStatus) return;

  updateOrderStatus(orderId, newStatus);

  const order = getOrderById(orderId);
  if (!order) return ctx.reply('Buyurtma topilmadi');

  await ctx.editMessageText(
    `✅ Buyurtma #${orderId} statusı: *${newStatus}*`,
    { parse_mode: 'Markdown' }
  ).catch(() => ctx.reply(`Buyurtma #${orderId} → ${newStatus}`));

  // Foydalanuvchiga xabar yuborish (lokalizatsiya bilan)
  try {
    const user = getUser(order.user_id) || null;
    if (user) {
      const userLang = user.language || 'uz';
      let msgText = '';
      if (newStatus === 'confirmed') msgText = getText(userLang, 'order_confirmed');
      else if (newStatus === 'rejected') {
        msgText = getText(userLang, 'order_rejected');
        const contact = process.env.CONTACT_USERNAME ? `@${process.env.CONTACT_USERNAME}` : '';
        if (contact) msgText += `\n\n${getText(userLang, 'help_text', { contact: process.env.CONTACT_USERNAME })}`;
      } else if (newStatus === 'done') msgText = getText(userLang, 'order_done');

      await bot.telegram.sendMessage(
        user.telegram_id,
        `*Buyurtma #${orderId}*\n\n${msgText}`,
        { parse_mode: 'Markdown' }
      );
    }
  } catch (e) {
    logger.warn(`User notification error: ${e.message}`);
  }

  logger.info(`Order #${orderId} → ${newStatus} by admin ${ctx.from.id}`);
}

// ─── TO'LOVLAR ────────────────────────────────────────────────────────────────

export async function handlePaymentsList(ctx) {
  if (!isAdmin(ctx.from.id)) return deny(ctx);
  if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});

  const { getAllPayments } = await import('../services/database.js');
  const payments = getAllPayments().slice(0, 20);

  let text = `💰 *TO'LOVLAR* (oxirgi 20)\n\n`;
  payments.forEach(p => {
    const uname = p.username ? `@${escapeMarkdown(p.username)}` : escapeMarkdown(p.first_name || p.telegram_id);
    text += `#${p.id} | ${uname} | ${p.amount}⭐ | ${escapeMarkdown(p.payment_method)} | ${new Date(p.created_at).toLocaleDateString()}\n`;
  });

  if (!payments.length) text += 'To\'lovlar yo\'q';

  const opts = {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [[{ text: '← Orqaga', callback_data: 'admin:menu' }]] },
  };

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, opts).catch(() => ctx.reply(text, opts));
  } else {
    await ctx.reply(text, opts);
  }
}

// ─── BAN / UNBAN ─────────────────────────────────────────────────────────────

export async function handleBanUser(ctx, telegramId) {
  if (!isAdmin(ctx.from.id)) return deny(ctx);
  await ctx.answerCbQuery().catch(() => {});
  ctx.session.banMode = telegramId;
  const lang = ctx.session?.language || 'uz';
  await ctx.reply(getText(lang, 'ban_prompt'));
}

export async function handleUnbanUser(ctx, telegramId) {
  if (!isAdmin(ctx.from.id)) return deny(ctx);
  await ctx.answerCbQuery().catch(() => {});
  unbanUser(telegramId);
  const lang = ctx.session?.language || 'uz';
  await ctx.reply(getText(lang, 'user_unbanned', { id: telegramId }));

  try {
    const u = getUser(telegramId) || {};
    const userLang = u.language || 'uz';
    await ctx.telegram.sendMessage(telegramId, getText(userLang, 'you_unbanned'));
  } catch (e) { /* silent */ }

  logger.info(`User ${telegramId} unbanned by admin ${ctx.from.id}`);
}

// ─── BROADCAST ───────────────────────────────────────────────────────────────

export async function handleBroadcast(ctx) {
  if (!isOwner(ctx.from.id)) return deny(ctx);
  if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});
  ctx.session.broadcastMode = true;
  await ctx.reply('📢 *BROADCAST*\n\nHammasiga yuboriladigan xabarni yozing:', { parse_mode: 'Markdown' });
}

export async function sendBroadcastMessage(bot, message) {
  const users = getAllUsers().filter(u => !u.is_banned);
  let ok = 0, fail = 0;

  for (const user of users) {
    try {
      await bot.telegram.sendMessage(user.telegram_id, message, { parse_mode: 'Markdown' });
      ok++;
      await new Promise(r => setTimeout(r, 35)); // Telegram limit: ~30 msg/s
    } catch (e) {
      fail++;
    }
  }

  logger.info(`Broadcast done: ${ok} ok, ${fail} fail`);
  return { ok, fail };
}

// ─── SOZLAMALAR ──────────────────────────────────────────────────────────────

export async function handleSettings(ctx) {
  if (!isOwner(ctx.from.id)) return deny(ctx);
  if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});

  const channel = escapeMarkdown(getRequiredChannel() || 'yo\'q');
  const group   = escapeMarkdown(getRequiredGroup()   || 'yo\'q');
  const admins  = getAdminsFromDb();

  const text =
    `⚙️ *BOT SOZLAMALARI*\n\n` +
    `🔗 Majburiy kanal: ${channel}\n` +
    `👥 Majburiy guruh: ${group}\n` +
    `👮 Admin soni: ${admins.length} ta`;

  const opts = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔗 Kanal o\'rnatish',  callback_data: 'settings:add_channel'    }],
        [{ text: '🗑️ Kanalni o\'chirish', callback_data: 'settings:remove_channel' }],
        [{ text: '👥 Guruh o\'rnatish',   callback_data: 'settings:add_group'      }],
        [{ text: '🗑️ Guruhni o\'chirish', callback_data: 'settings:remove_group'   }],
        [{ text: '👮 Admin qo\'shish',    callback_data: 'settings:add_admin'      }],
        [{ text: '🗑️ Adminni o\'chirish', callback_data: 'settings:remove_admin'   }],
        [{ text: '← Orqaga',              callback_data: 'admin:menu'              }],
      ],
    },
  };

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, opts).catch(() => ctx.reply(text, opts));
  } else {
    await ctx.reply(text, opts);
  }
}

export default {
  isAdmin, isOwner,
  handleAdminPanel, handleStats, handleUsersList, handleUserDetails,
  handleOrdersList, handleOrderDetail, handleOrderAction,
  handlePaymentsList, handleBanUser, handleUnbanUser,
  handleBroadcast, sendBroadcastMessage, handleSettings,
};