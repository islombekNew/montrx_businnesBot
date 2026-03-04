/**
 * Referal tizimi
 */

import { getUser, getAllUsers, addStars } from '../services/database.js';
import { logger } from '../utils/logger.js';

const REFERRAL_BONUS_STARS = 50; // Har bir referal uchun bonus

export async function handleReferralInfo(ctx) {
  const lang = ctx.session?.language || 'uz';
  const user = getUser(ctx.from.id);
  if (!user) return;

  await ctx.answerCbQuery().catch(() => {});

  const botInfo = await ctx.telegram.getMe();
  const refLink = `https://t.me/${botInfo.username}?start=ref_${user.referral_code}`;

  const text =
    `👥 *REFERAL TIZIMI*\n\n` +
    `Har bir do'stingiz uchun *${REFERRAL_BONUS_STARS} ⭐ Stars* oling!\n\n` +
    `🔗 Sizning referal linkingiz:\n\`${refLink}\`\n\n` +
    `📊 Statistika:\n` +
    `• Taklif qilganlar: *${user.referral_count}* kishi\n` +
    `• Jami bonus: *${user.referral_count * REFERRAL_BONUS_STARS} ⭐*\n\n` +
    `_Linkni do'stlaringizga yuboring!_`;

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '📤 Do\'stlarga ulashish', switch_inline_query: `MONTRAX botiga taklif qilaman: ${refLink}` }],
        [{ text: '← Orqaga', callback_data: 'menu:main' }],
      ],
    },
  });
}

export async function processReferral(ctx, referralCode) {
  if (!referralCode) return;

  const referrer = getAllUsers().find(u => u.referral_code === referralCode);
  if (!referrer || referrer.telegram_id === ctx.from.id) return;

  const newUser = getUser(ctx.from.id);
  if (!newUser || newUser.referred_by) return; // Allaqachon referal bor

  try {
    addStars(referrer.telegram_id, REFERRAL_BONUS_STARS);
    logger.info(`Referral bonus: ${referrer.telegram_id} got ${REFERRAL_BONUS_STARS} stars`);

    await ctx.telegram.sendMessage(
      referrer.telegram_id,
      `🎉 *Referal bonus!*\n\n` +
      `${ctx.from.first_name || 'Yangi foydalanuvchi'} sizning linkingiz orqali qo'shildi!\n` +
      `*+${REFERRAL_BONUS_STARS} ⭐ Stars* hisobingizga qo'shildi!`,
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    logger.warn(`Referral processing error: ${e.message}`);
  }
}
