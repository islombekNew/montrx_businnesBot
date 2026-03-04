import { logger } from '../utils/logger.js';
import { getUser, getRequiredChannel, getRequiredGroup } from '../services/database.js';
import { getText } from '../locales/index.js';

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
    // If we can't confidently verify membership, treat as NOT a member
    // so required-subscription flow still prompts the user.
    return false;
  }
}

export default async function checkSubscription(ctx, next) {
  if (!ctx.from) return next();
  const IDS = [
    Number(process.env.OWNER_ID || 0),
    Number(process.env.ADMIN_ID || 0),
    Number(process.env.SECOND_ADMIN_ID || 0),
  ].filter(Boolean);
  if (IDS.includes(ctx.from.id)) return next();

  const user = getUser(ctx.from.id);
  if (user && user.is_banned) {
    if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});
    else {
      const lang = ctx.session?.language || 'uz';
      await ctx.reply(getText(lang, 'banned', { contact: getContact() })).catch(() => {});
    }
    return;
  }

  const ch = cleanHandle(getRequiredChannel());
  if (ch) {
    const ok = await isMember(ctx, ch);
    if (!ok) {
      if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});
      const lang = ctx.session?.language || 'uz';
      await ctx.reply(getText(lang, 'must_sub_channel', { channel: ch }), {
        reply_markup: { inline_keyboard: [
          [{ text: getText(lang, 'btn_go_to_channel', { channel: ch }), url: 'https://t.me/' + ch }],
          [{ text: getText(lang, 'btn_i_subscribed'), callback_data: 'check_sub' }],
          [{ text: getText(lang, 'btn_help'), url: 'https://t.me/' + getContact() }],
        ]},
      }).catch(() => {});
      return;
    }
  }

  const gr = cleanHandle(getRequiredGroup());
  if (gr) {
    const ok = await isMember(ctx, gr);
    if (!ok) {
      if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});
      const lang = ctx.session?.language || 'uz';
      await ctx.reply(getText(lang, 'must_sub_group', { group: gr }), {
        reply_markup: { inline_keyboard: [
          [{ text: getText(lang, 'btn_go_to_group', { group: gr }), url: 'https://t.me/' + gr }],
          [{ text: getText(lang, 'btn_i_joined'), callback_data: 'check_sub' }],
        ]},
      }).catch(() => {});
      return;
    }
  }

  return next();
}
