import { logger } from '../utils/logger.js';
import { getUser, getRequiredChannel, getRequiredGroup } from '../services/database.js';

function getContact() { return process.env.CONTACT_USERNAME || 'MONTRAX_offical'; }

function cleanHandle(input) {
  if (!input) return null;
  let s = String(input).trim();
  s = s.replace(/^https?:\/\/t\.me\//, '');
  s = s.replace(/^@+/, '');
  s = s.replace(/\/$/, '').trim();
  return s.length > 0 ? s : null;
}

async function isMember(ctx, handle) {
  try {
    const m = await ctx.telegram.getChatMember('@' + handle, ctx.from.id);
    return ['member', 'administrator', 'creator'].includes(m.status);
  } catch (e) {
    logger.warn('Sub @' + handle + ': ' + e.message);
    return false;
  }
}

// Chiroyli obuna xabari — kanal va guruh birgalikda ko'rsatiladi
async function sendSubscriptionMessage(ctx, missing) {
  const lang = ctx.session?.language || 'uz';
  if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});

  // ── Matn ──
  const lines = {
    uz: {
      title:   '🔐 Botdan foydalanish uchun obuna bo\'ling',
      body:    'Quyidagi kanallarga obuna bo\'lib,\n«✅ Tekshirish» tugmasini bosing.',
      channel: '📢 Kanal',
      group:   '👥 Guruh',
      check:   '✅ Tekshirish',
      help:    '💬 Yordam',
    },
    ru: {
      title:   '🔐 Подпишитесь для использования бота',
      body:    'Подпишитесь на каналы ниже\nи нажмите «✅ Проверить».',
      channel: '📢 Канал',
      group:   '👥 Группа',
      check:   '✅ Проверить',
      help:    '💬 Помощь',
    },
    en: {
      title:   '🔐 Subscribe to use the bot',
      body:    'Subscribe to the channels below\nand press «✅ Check».',
      channel: '📢 Channel',
      group:   '👥 Group',
      check:   '✅ Check',
      help:    '💬 Help',
    },
  };

  const t = lines[lang] || lines.uz;

  // Xabar matni
  let text = `${t.title}\n\n${t.body}\n`;

  // Tugmalar — har bir kanal/guruh alohida qatorda, belgisi bilan
  const keyboard = [];

  for (const item of missing) {
    const icon = item.type === 'channel' ? '📢' : '👥';
    const label = item.type === 'channel' ? t.channel : t.group;
    keyboard.push([{
      text: `${icon} ${label}: @${item.handle}`,
      url:  `https://t.me/${item.handle}`,
    }]);
  }

  keyboard.push([{ text: t.check, callback_data: 'check_sub' }]);
  keyboard.push([{ text: `${t.help} @${getContact()}`, url: `https://t.me/${getContact()}` }]);

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard },
  }).catch(() => {});
}

export default async function checkSubscription(ctx, next) {
  if (!ctx.from) return next();

  // Admin/owner tekshiruvsiz o'tadi
  const IDS = [
    Number(process.env.OWNER_ID        || 0),
    Number(process.env.ADMIN_ID        || 0),
    Number(process.env.SECOND_ADMIN_ID || 0),
  ].filter(Boolean);
  if (IDS.includes(ctx.from.id)) return next();

  // Ban tekshiruvi
  const user = getUser(ctx.from.id);
  if (user?.is_banned) {
    if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});
    else {
      const lang = ctx.session?.language || 'uz';
      const banned = {
        uz: `🚫 Siz bloklangansiz. Murojaat: @${getContact()}`,
        ru: `🚫 Вы заблокированы. Обратитесь: @${getContact()}`,
        en: `🚫 You are banned. Contact: @${getContact()}`,
      };
      await ctx.reply(banned[lang] || banned.uz).catch(() => {});
    }
    return;
  }

  // Kanal va guruhni parallel tekshirish
  const ch = cleanHandle(getRequiredChannel());
  const gr = cleanHandle(getRequiredGroup());

  const missing = [];

  if (ch) {
    const ok = await isMember(ctx, ch);
    if (!ok) missing.push({ type: 'channel', handle: ch });
  }

  if (gr) {
    const ok = await isMember(ctx, gr);
    if (!ok) missing.push({ type: 'group', handle: gr });
  }

  if (missing.length > 0) {
    await sendSubscriptionMessage(ctx, missing);
    return; // Obuna bo'lmagan — to'xtat
  }

  return next();
}