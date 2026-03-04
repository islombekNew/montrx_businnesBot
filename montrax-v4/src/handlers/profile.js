/**
 * Foydalanuvchi profili va buyurtmalari
 */

import { getUser, getUserOrders } from '../services/database.js';
import { getMainKeyboard } from '../keyboards/index.js';

const STATUS_EMOJI = {
  pending:   '⏳',
  confirmed: '✅',
  rejected:  '❌',
  done:      '🎉',
};

export async function handleMyProfile(ctx) {
  const lang = ctx.session?.language || 'uz';
  const user = getUser(ctx.from.id);
  if (!user) return ctx.reply('❌ Profil topilmadi');

  await ctx.answerCbQuery().catch(() => {});

  const premiumInfo = user.is_premium
    ? `✨ Premium (${user.premium_expires ? new Date(user.premium_expires).toLocaleDateString('uz-UZ') + ' gacha' : 'faol'})`
    : '📱 Oddiy';

  const text =
    `👤 *PROFILIM*\n\n` +
    `🆔 ID: \`${user.telegram_id}\`\n` +
    `📝 Ism: ${user.first_name || 'Noma\'lum'}\n` +
    `🌐 Til: ${user.language?.toUpperCase()}\n` +
    `👑 Status: ${premiumInfo}\n` +
    `⭐ Stars: *${user.stars_balance}*\n` +
    `👥 Referallar: *${user.referral_count}*\n` +
    `📅 Qo'shilgan: ${new Date(user.created_at).toLocaleDateString('uz-UZ')}`;

  const opts = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '📦 Buyurtmalarim', callback_data: 'my:orders'   }],
        [{ text: '👥 Referal',       callback_data: 'referral:info'}],
        [{ text: '← Orqaga',         callback_data: 'menu:main'   }],
      ],
    },
  };

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, opts).catch(() => ctx.reply(text, opts));
  } else {
    await ctx.reply(text, opts);
  }
}

export async function handleMyOrders(ctx) {
  const lang   = ctx.session?.language || 'uz';
  const orders = getUserOrders(ctx.from.id);

  await ctx.answerCbQuery().catch(() => {});

  if (!orders.length) {
    const opts = {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '← Orqaga', callback_data: 'my:profile' }]],
      },
    };
    if (ctx.callbackQuery) {
      await ctx.editMessageText('📦 Hali buyurtmalaringiz yo\'q.', opts)
        .catch(() => ctx.reply('📦 Hali buyurtmalaringiz yo\'q.', opts));
    } else {
      await ctx.reply('📦 Hali buyurtmalaringiz yo\'q.', opts);
    }
    return;
  }

  let text = `📦 *BUYURTMALARIM* (${orders.length} ta)\n\n`;
  orders.slice(0, 10).forEach(o => {
    const emoji = STATUS_EMOJI[o.status] || '📋';
    text += `${emoji} *#${o.id}* — ${o.category}\n`;
    text += `   💰 ${o.budget} | ${new Date(o.created_at).toLocaleDateString('uz-UZ')}\n\n`;
  });

  const opts = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[{ text: '← Orqaga', callback_data: 'my:profile' }]],
    },
  };

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, opts).catch(() => ctx.reply(text, opts));
  } else {
    await ctx.reply(text, opts);
  }
}
