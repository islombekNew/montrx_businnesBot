import { logger } from '../utils/logger.js';
import { addPayment, addStars, upgradePremium, getUser } from '../services/database.js';
import { getMainKeyboard } from '../keyboards/index.js';
import { getText } from '../locales/index.js';

const CONTACT = () => process.env.CONTACT_USERNAME || 'MONTRAX_offical';

const STARS_PACKAGES = {
  stars_50:   { label: '⭐ 50 Stars',   stars: 50,   priceText: '15,000 UZS'  },
  stars_100:  { label: '⭐ 100 Stars',  stars: 100,  priceText: '25,000 UZS'  },
  stars_500:  { label: '⭐ 500 Stars',  stars: 500,  priceText: '100,000 UZS' },
  stars_1000: { label: '⭐ 1000 Stars', stars: 1000, priceText: '180,000 UZS' },
};

// Telegram Premium narxlari (UZS)
const PREMIUM_PACKAGES = {
  premium_1:       { label: '👑 1 oy Premium',          months: 1,  priceText: '40,000 UZS',  gift: false },
  premium_3:       { label: '👑 3 oy Premium',          months: 3,  priceText: '150,000 UZS', gift: false },
  premium_12:      { label: '👑 1 yil Premium',         months: 12, priceText: '490,000 UZS', gift: false },
  premium_12_gift: { label: '🎁 1 yil Premium (sovg\'a)', months: 12, priceText: '470,000 UZS', gift: true  },
};

export const PRODUCTS = { ...STARS_PACKAGES, ...PREMIUM_PACKAGES };

// ─── DO'KON MENYU ─────────────────────────────────────────────────────────────

export async function handleShopMenu(ctx) {
  await ctx.answerCbQuery().catch(() => {});
  const text = '🛍️ *MONTRAX DO\'KON*\n\nNima sotib olmoqchisiz?';
  const opts = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '⭐ Bot Stars sotib olish',   callback_data: 'shop:stars'   }],
        [{ text: '👑 Telegram Premium olish',  callback_data: 'shop:premium' }],
        [{ text: '🎁 Sovg\'a yuborish (Gift)', callback_data: 'shop:gift'    }],
        [{ text: '← Orqaga',                   callback_data: 'menu:main'    }],
      ],
    },
  };
  await ctx.editMessageText(text, opts).catch(() => ctx.reply(text, opts));
}

// ─── BOT STARS ────────────────────────────────────────────────────────────────

export async function handleStarsShop(ctx) {
  await ctx.answerCbQuery().catch(() => {});
  const text =
    '⭐ *BOT STARS SOTIB OLISH*\n\n' +
    'Stars — botdagi ichki valyuta.\n' +
    'Xizmat buyurtma qilishda va referal bonuslarida ishlatiladi.\n\n' +
    '💳 To\'lov: *Click yoki Payme* (so\'mda)\n\n' +
    '📦 Paketlar:';
  const opts = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '⭐ 50 Stars  — 15,000 UZS',  callback_data: 'stars:buy:stars_50'   }],
        [{ text: '⭐ 100 Stars — 25,000 UZS',  callback_data: 'stars:buy:stars_100'  }],
        [{ text: '⭐ 500 Stars — 100,000 UZS', callback_data: 'stars:buy:stars_500'  }],
        [{ text: '⭐ 1000 Stars— 180,000 UZS', callback_data: 'stars:buy:stars_1000' }],
        [{ text: '← Orqaga',                   callback_data: 'shop:menu'            }],
      ],
    },
  };
  await ctx.editMessageText(text, opts).catch(() => ctx.reply(text, opts));
}

export async function handleStarsOrder(ctx) {
  await ctx.answerCbQuery().catch(() => {});
  const productId = ctx.match[1];
  const product   = STARS_PACKAGES[productId];
  if (!product) {
    const lang = ctx.session?.language || 'uz';
    return ctx.reply(getText(lang, 'product_not_found'));
  }

  const text =
    `⭐ *${product.label}*\n\n` +
    `💰 Narx: *${product.priceText}*\n\n` +
    `📱 *To\'lov qilish tartibi:*\n` +
    `1️⃣ @${CONTACT()} ga yozing\n` +
    `2️⃣ _"${product.label} sotib olmoqchiman"_ deb yozing\n` +
    `3️⃣ Click yoki Payme raqamini so\'rang va to\'lang\n` +
    `4️⃣ To\'lov tasdiqlangach admin /givestars buyrug\'i bilan\n` +
    `    Stars hisobingizga qo\'shiladi ✅`;

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '💬 To\'lov qilish', url: `https://t.me/${CONTACT()}` }],
        [{ text: '← Orqaga',          callback_data: 'shop:stars'      }],
      ],
    },
  });
}

// ─── TELEGRAM PREMIUM ─────────────────────────────────────────────────────────

export async function handlePremiumShop(ctx) {
  await ctx.answerCbQuery().catch(() => {});
  const text =
    '👑 *TELEGRAM PREMIUM*\n\n' +
    '✨ *Premium imkoniyatlari:*\n' +
    '• Telegram Premium badge 👑\n' +
    '• 4GB fayl yuklash (oddiy: 2GB)\n' +
    '• Tezroq yuklash\n' +
    '• Maxsus stikerlar va reaksiyalar\n' +
    '• Yashirin telefon raqami\n' +
    '• Va yana ko\'p narsalar!\n\n' +
    '💳 To\'lov: *Click yoki Payme* (so\'mda)\n\n' +
    '⚠️ *Eslatma:* Premium Telegram tomonidan qo\'lda sovg\'a sifatida yuboriladi';
  const opts = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '1 oy  — 40,000 UZS',                callback_data: 'premium:buy:premium_1'       }],
        [{ text: '3 oy  — 150,000 UZS',               callback_data: 'premium:buy:premium_3'       }],
        [{ text: '1 yil — 490,000 UZS (o\'zingizga)', callback_data: 'premium:buy:premium_12'      }],
        [{ text: '1 yil — 470,000 UZS (sovg\'a)',     callback_data: 'premium:buy:premium_12_gift' }],
        [{ text: '← Orqaga',                           callback_data: 'shop:menu'                   }],
      ],
    },
  };
  await ctx.editMessageText(text, opts).catch(() => ctx.reply(text, opts));
}

export async function handlePremiumOrder(ctx) {
  await ctx.answerCbQuery().catch(() => {});
  const productId = ctx.match[1];
  const product   = PREMIUM_PACKAGES[productId];
  if (!product) {
    const lang = ctx.session?.language || 'uz';
    return ctx.reply(getText(lang, 'product_not_found'));
  }

  const isGift = product.gift;
  const extraNote = isGift
    ? '🎁 *Sovg\'a uchun:* kimga yuborilishini ham yozing (username yoki telefon)'
    : '👤 *O\'zingizga:* username yoki telefon raqamingizni yozing';

  const text =
    `${isGift ? '🎁' : '👑'} *${product.label}*\n\n` +
    `💰 Narx: *${product.priceText}*\n\n` +
    `📱 *To\'lov qilish tartibi:*\n` +
    `1️⃣ @${CONTACT()} ga yozing\n` +
    `2️⃣ _"${product.label} olmoqchiman"_ deb yozing\n` +
    `3️⃣ ${extraNote}\n` +
    `4️⃣ Click yoki Payme orqali to\'lang\n` +
    `5️⃣ Admin Telegram orqali Premium sovg\'a yuboradi ✅\n\n` +
    `⏱ Vaqt: to\'lov tasdiqlangandan so\'ng *30 daqiqa* ichida`;

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '💬 Buyurtma berish', url: `https://t.me/${CONTACT()}` }],
        [{ text: '← Orqaga',           callback_data: 'shop:premium'    }],
      ],
    },
  });
}

// ─── GIFT (Telegram Stars XTR) ────────────────────────────────────────────────

export async function handleGiftShop(ctx) {
  await ctx.answerCbQuery().catch(() => {});
  const text =
    '🎁 *TELEGRAM STARS SOVG\'A*\n\n' +
    'Do\'stingizga Telegram Stars sovg\'a qiling!\n\n' +
    '💡 Bu Telegram\'ning rasmiy Stars tizimi orqali amalga oshiriladi\n' +
    '(Telegram Stars — Telegram\'ning o\'z valyutasi)';
  const opts = {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '⭐ 50 Stars',   callback_data: 'gift:50'   },
          { text: '⭐ 100 Stars',  callback_data: 'gift:100'  },
        ],
        [
          { text: '⭐ 500 Stars',  callback_data: 'gift:500'  },
          { text: '⭐ 1000 Stars', callback_data: 'gift:1000' },
        ],
        [{ text: '← Orqaga', callback_data: 'shop:menu' }],
      ],
    },
  };
  await ctx.editMessageText(text, opts).catch(() => ctx.reply(text, opts));
}

export async function handleGiftPurchase(ctx) {
  const amount = Number(ctx.match[1]);
  if (!amount) return ctx.answerCbQuery('Xato').catch(() => {});
  await ctx.answerCbQuery().catch(() => {});
  try {
    await ctx.replyWithInvoice({
      title:          `🎁 ${amount} Telegram Stars Sovg'a`,
      description:    `Botga ${amount} ta Telegram Stars sovg'a yuborish`,
      payload:        `gift:${amount}:${ctx.from.id}`,
      provider_token: '',
      currency:       'XTR',
      prices:         [{ label: `${amount} Stars`, amount }],
    });
  } catch (e) {
    logger.error(`Gift invoice error: ${e.message}`);
    await ctx.reply('❌ Xato yuz berdi. Qayta urinib ko\'ring.');
  }
}

// ─── TO'LOV MUVAFFAQIYATLI ────────────────────────────────────────────────────

export async function handleSuccessfulPayment(ctx, ADMIN_IDS) {
  const payment = ctx.message.successful_payment;
  const payload = payment.invoice_payload;
  const amount  = payment.total_amount;
  const userId  = ctx.from.id;
  const lang    = ctx.session?.language || 'uz';

  let successMsg = `🎉 *${amount} Telegram Stars* sovg'a sifatida yuborildi!\n\nRahmat!`;

  try { addPayment(userId, amount, 'telegram_stars', payload); } catch (_) {}

  await ctx.reply(successMsg, { parse_mode: 'Markdown', ...getMainKeyboard(lang) });

  const uname    = ctx.from.username ? `@${ctx.from.username}` : `ID:${ctx.from.id}`;
  const adminMsg =
    `💰 *GIFT TO'LOV KELDI*\n\n` +
    `👤 ${ctx.from.first_name || ''} ${uname}\n` +
    `⭐ ${amount} Telegram Stars\n` +
    `📦 Payload: ${payload}`;

  for (const adminId of ADMIN_IDS) {
    try { await ctx.telegram.sendMessage(adminId, adminMsg, { parse_mode: 'Markdown' }); } catch (_) {}
  }
}

// ─── ADMIN: QO'LDA STARS VA PREMIUM BERISH ───────────────────────────────────

export async function adminGiveStars(ctx, telegramId, amount) {
  addStars(telegramId, amount);
  try {
    const user = getUser(telegramId) || {};
    const userLang = user.language || 'uz';
    await ctx.telegram.sendMessage(
      telegramId,
      getText(userLang, 'you_received_stars', { amount }),
      { parse_mode: 'Markdown', ...getMainKeyboard(userLang) }
    );
  } catch (_) {}
  logger.info(`Admin gave ${amount} stars to user ${telegramId}`);
}

export async function adminGivePremium(ctx, telegramId, months) {
  upgradePremium(telegramId, months);
  try {
    const user = getUser(telegramId) || {};
    const userLang = user.language || 'uz';
    await ctx.telegram.sendMessage(
      telegramId,
      getText(userLang, 'you_received_premium', { months }),
      { parse_mode: 'Markdown', ...getMainKeyboard(userLang) }
    );
  } catch (_) {}
  logger.info(`Admin confirmed ${months}mo premium for user ${telegramId}`);
}
