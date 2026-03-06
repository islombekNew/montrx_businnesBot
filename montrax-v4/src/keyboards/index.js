import { getText } from '../locales/index.js';

const CONTACT = process.env.CONTACT_USERNAME || 'MONTRAX_offical';

export function getLanguageKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [[
        { text: '🇺🇿 O\'zbek',  callback_data: 'lang:uz' },
        { text: '🇷🇺 Русский', callback_data: 'lang:ru' },
        { text: '🇬🇧 English', callback_data: 'lang:en' },
      ]],
    },
  };
}

export function getMainKeyboard(lang = 'uz') {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: getText(lang, 'frontend'), callback_data: 'cat:frontend' },
          { text: getText(lang, 'graphic'),  callback_data: 'cat:graphic'  },
        ],
        [
          { text: getText(lang, 'backend'),  callback_data: 'cat:backend' },
          { text: getText(lang, 'mobile'),   callback_data: 'cat:mobile'  },
        ],
        [
          { text: getText(lang, 'uiux'),     callback_data: 'cat:uiux' },
          { text: getText(lang, 'smm'),      callback_data: 'cat:smm'  },
        ],
        [
          { text: getText(lang, 'buy_stars'),   callback_data: 'shop:stars'   },
          { text: getText(lang, 'buy_premium'), callback_data: 'shop:premium' },
        ],
        [
          { text: getText(lang, 'send_gift'), callback_data: 'shop:gift'    },
          { text: getText(lang, 'referral'),  callback_data: 'referral:info' },
        ],
        [
          { text: getText(lang, 'my_orders'),  callback_data: 'my:orders'  },
          { text: getText(lang, 'my_profile'), callback_data: 'my:profile' },
        ],
        [
          { text: '🌐 Tilni o\'zgartirish', callback_data: 'lang:change' },
          { text: '📞 Bog\'lanish', url: `https://t.me/${CONTACT}` },
        ],
      ],
    },
  };
}

export function getPaymentKeyboard(lang = 'uz') {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '⭐ Telegram Stars', callback_data: 'paymethod:stars' }],
        [
          { text: '💳 Click',  callback_data: 'paymethod:click' },
          { text: '💰 Payme',  callback_data: 'paymethod:payme' },
        ],
        [{ text: getText(lang, 'back'), callback_data: 'menu:main' }],
      ],
    },
  };
}

export function getOrderStatusKeyboard(orderId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Tasdiqlash', callback_data: `order:confirm:${orderId}` },
          { text: '❌ Rad etish',  callback_data: `order:reject:${orderId}`  },
        ],
        [
          { text: '🎉 Bajarildi', callback_data: `order:done:${orderId}`   },
          { text: '📋 Batafsil',  callback_data: `order:detail:${orderId}` },
        ],
      ],
    },
  };
}

export function getBackKeyboard(lang = 'uz', target = 'menu:main') {
  return {
    reply_markup: {
      inline_keyboard: [[{ text: getText(lang, 'back'), callback_data: target }]],
    },
  };
}

export function getStarsShopKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '⭐ 100 Stars',  callback_data: 'buy:stars_100'  }],
        [{ text: '⭐ 500 Stars',  callback_data: 'buy:stars_500'  }],
        [{ text: '⭐ 1000 Stars', callback_data: 'buy:stars_1000' }],
        [{ text: '← Orqaga',     callback_data: 'menu:main'      }],
      ],
    },
  };
}

export function getPremiumShopKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '👑 1 oy  — 50,000 UZS',  callback_data: 'buy:premium_1'  }],
        [{ text: '👑 3 oy  — 130,000 UZS', callback_data: 'buy:premium_3'  }],
        [{ text: '👑 1 yil — 450,000 UZS', callback_data: 'buy:premium_12' }],
        [{ text: '← Orqaga',               callback_data: 'menu:main'      }],
      ],
    },
  };
}

export function getGiftKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '⭐ 50 Stars',  callback_data: 'gift:50'   },
          { text: '⭐ 100 Stars', callback_data: 'gift:100'  },
        ],
        [
          { text: '⭐ 500 Stars',  callback_data: 'gift:500'  },
          { text: '⭐ 1000 Stars', callback_data: 'gift:1000' },
        ],
        [{ text: '← Orqaga', callback_data: 'menu:main' }],
      ],
    },
  };
}

export default {
  getLanguageKeyboard,
  getMainKeyboard,
  getPaymentKeyboard,
  getOrderStatusKeyboard,
  getBackKeyboard,
  getStarsShopKeyboard,
  getPremiumShopKeyboard,
  getGiftKeyboard,
};