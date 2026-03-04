/**
 * Text Message Handler - Xabarlar bo'limi
 */

import { logger } from '../utils/logger.js';
import { getText } from '../locales/index.js';
import { getMainKeyboard } from '../keyboards/index.js';
import {
  setRequiredChannel, setRequiredGroup, addAdminId, removeAdminId,
  banUser, getAllUsers,
} from '../services/database.js';
import { isAdmin, isOwner, handleUserDetails, handleSettings, sendBroadcastMessage } from './admin.js';
import { handleServiceDescription, handleServiceBudget, handleServiceAdditional } from './services.js';

/**
 * Kanalni o'rnatish
 */
export async function handleChannelSetting(ctx) {
  ctx.session.addChannelMode = false;
  try {
    const input = ctx.message.text.trim();
    const clean = input.startsWith('@') ? input : '@' + input;
    setRequiredChannel(clean);
    await ctx.reply(getText(ctx.session?.language || 'uz', 'channel_set', { channel: clean }));
    return handleSettings(ctx);
  } catch (err) {
    logger.error('Channel setting error:', err);
    await ctx.reply(getText(ctx.session?.language || 'uz', 'error')).catch(() => {});
  }
}

/**
 * Guruhni o'rnatish
 */
export async function handleGroupSetting(ctx) {
  ctx.session.addGroupMode = false;
  try {
    const input = ctx.message.text.trim();
    const clean = input.startsWith('@') ? input : '@' + input;
    setRequiredGroup(clean);
    await ctx.reply(getText(ctx.session?.language || 'uz', 'group_set', { group: clean }));
    return handleSettings(ctx);
  } catch (err) {
    logger.error('Group setting error:', err);
    await ctx.reply(getText(ctx.session?.language || 'uz', 'error')).catch(() => {});
  }
}

/**
 * Adminni qo'shish
 */
export async function handleAddAdmin(ctx) {
  ctx.session.addAdminMode = false;
  try {
    const input = ctx.message.text.trim();
    if (!/^\d+$/.test(input)) {
      return ctx.reply(getText(ctx.session?.language || 'uz', 'invalid_input'));
    }
    addAdminId(Number(input), ctx.from.id);
    await ctx.reply(getText(ctx.session?.language || 'uz', 'admin_added', { id: input }));
    return handleSettings(ctx);
  } catch (err) {
    logger.error('Add admin error:', err);
    await ctx.reply(getText(ctx.session?.language || 'uz', 'error')).catch(() => {});
  }
}

/**
 * Adminni o'chirish
 */
export async function handleRemoveAdmin(ctx) {
  ctx.session.removeAdminMode = false;
  try {
    const input = ctx.message.text.trim();
    if (!/^\d+$/.test(input)) {
      return ctx.reply(getText(ctx.session?.language || 'uz', 'invalid_input'));
    }
    removeAdminId(Number(input));
    await ctx.reply(getText(ctx.session?.language || 'uz', 'admin_removed', { id: input }));
    return handleSettings(ctx);
  } catch (err) {
    logger.error('Remove admin error:', err);
    await ctx.reply(getText(ctx.session?.language || 'uz', 'error')).catch(() => {});
  }
}

/**
 * Foydalanuvchini ban qilish sababi
 */
export async function handleBanReason(ctx) {
  try {
    const telegramId = ctx.session.banMode;
    ctx.session.banMode = null;
    const reason = ctx.message.text.trim();

    banUser(telegramId, reason);
    await ctx.reply(
      getText(ctx.session?.language || 'uz', 'user_banned', { id: telegramId, reason })
    );

    try {
      const contact = process.env.CONTACT_USERNAME || 'MONTRAX_offical';
      await ctx.telegram.sendMessage(
        telegramId,
        `🚫 ${getText(ctx.session?.language || 'uz', 'banned', { contact })}`
      );
    } catch (_) {
      logger.warn(`User ${telegramId} ga xabar yuborishda xato`);
    }
  } catch (err) {
    logger.error('Ban user error:', err);
    await ctx.reply(getText(ctx.session?.language || 'uz', 'error')).catch(() => {});
  }
}

/**
 * Broadcast xabari
 */
export async function handleBroadcasterMessage(ctx, bot) {
  ctx.session.broadcastMode = false;
  try {
    await ctx.reply(getText(ctx.session?.language || 'uz', 'broadcast_sending'));
    const message = ctx.message.text.trim();
    const result = await sendBroadcastMessage(bot, message);
    await ctx.reply(
      getText(ctx.session?.language || 'uz', 'broadcast_done', {
        ok: result.ok,
        fail: result.fail,
      })
    );
  } catch (err) {
    logger.error('Broadcast error:', err);
    await ctx.reply(getText(ctx.session?.language || 'uz', 'error')).catch(() => {});
  }
}

/**
 * Foydalanuvchi qidiruvi
 */
export async function handleUserSearch(ctx) {
  try {
    ctx.session.searchMode = null;
    const input = ctx.message.text.trim();
    const all = getAllUsers();
    let found = null;

    if (/^\d+$/.test(input)) {
      found = all.find(u => u.telegram_id === Number(input));
    } else if (input.startsWith('@')) {
      found = all.find(u => u.username === input.slice(1));
    } else {
      found = all.find(u => u.username === input || u.first_name === input);
    }

    if (found) {
      return handleUserDetails(ctx, found.telegram_id);
    }
    return ctx.reply(getText(ctx.session?.language || 'uz', 'user_not_found'));
  } catch (err) {
    logger.error('User search error:', err);
    await ctx.reply(getText(ctx.session?.language || 'uz', 'error')).catch(() => {});
  }
}

/**
 * Asosiy tekst xabari qayta ishlovchisi
 */
export async function handleTextMessage(ctx, bot, ADMIN_IDS) {
  const lang = ctx.session?.language || 'uz';
  const input = ctx.message.text.trim();

  try {
    // Kanal sozlamasi
    if (ctx.session.addChannelMode && isOwner(ctx.from.id)) {
      return handleChannelSetting(ctx);
    }

    // Guruh sozlamasi
    if (ctx.session.addGroupMode && isOwner(ctx.from.id)) {
      return handleGroupSetting(ctx);
    }

    // Admin qo'shish
    if (ctx.session.addAdminMode && isOwner(ctx.from.id)) {
      return handleAddAdmin(ctx);
    }

    // Admin o'chirish
    if (ctx.session.removeAdminMode && isOwner(ctx.from.id)) {
      return handleRemoveAdmin(ctx);
    }

    // Ban sababi
    if (ctx.session.banMode && isAdmin(ctx.from.id)) {
      return handleBanReason(ctx);
    }

    // Broadcast xabari
    if (ctx.session.broadcastMode && isOwner(ctx.from.id)) {
      return handleBroadcasterMessage(ctx, bot);
    }

    // Foydalanuvchi qidiruvi
    if (ctx.session.searchMode === 'user' && isAdmin(ctx.from.id)) {
      return handleUserSearch(ctx);
    }

    // Xizmat buyurtma qolimlari
    if (ctx.session.step === 1 && ctx.session.category) {
      return handleServiceDescription(ctx);
    }
    if (ctx.session.step === 2 && ctx.session.category) {
      return handleServiceBudget(ctx);
    }
    if (ctx.session.step === 3 && ctx.session.category) {
      return handleServiceAdditional(ctx, bot, ADMIN_IDS);
    }

    // Default - bosh menyu
    await ctx.reply(getText(lang, 'greeting'), getMainKeyboard(lang));
  } catch (err) {
    logger.error(`Text handler error [user: ${ctx.from?.id}]: ${err.message}`);
    await ctx.reply(getText(lang, 'error')).catch(() => {});
  }
}
