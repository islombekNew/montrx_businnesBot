/**
 * Xizmat buyurtma oqimi
 */

import { logger } from '../utils/logger.js';
import { addOrder } from '../services/database.js';
import { getText } from '../locales/index.js';
import { getMainKeyboard, getOrderStatusKeyboard } from '../keyboards/index.js';

export const SERVICES = {
  frontend: { name: 'Front-end 💻',       id: 'frontend' },
  backend:  { name: 'Back-end 🖥️',        id: 'backend'  },
  graphic:  { name: 'Grafik dizayn 🎨',   id: 'graphic'  },
  mobile:   { name: 'Mobil app 📱',        id: 'mobile'   },
  devops:   { name: 'DevOps 🔧',           id: 'devops'   },
  uiux:     { name: 'UI/UX dizayn 🖌️',    id: 'uiux'     },
  smm:      { name: 'SMM & Reklama 📈',    id: 'smm'      },
};

export async function handleServiceSelection(ctx) {
  const category = ctx.match[1];
  const lang     = ctx.session?.language || 'uz';

  if (!SERVICES[category]) {
    return ctx.answerCbQuery('Xizmat topilmadi').catch(() => {});
  }

  ctx.session.category    = category;
  ctx.session.step        = 1;
  ctx.session.description = null;
  ctx.session.budget      = null;

  await ctx.answerCbQuery().catch(() => {});
  await ctx.reply(
    `${SERVICES[category].name} xizmati tanlandi!\n\n${getText(lang, 'question1')}`,
    { reply_markup: { force_reply: true, selective: true } }
  );

  logger.info(`User ${ctx.from.id} selected: ${category}`);
}

export async function handleServiceDescription(ctx) {
  const lang = ctx.session?.language || 'uz';
  ctx.session.description = ctx.message.text;
  ctx.session.step = 2;

  await ctx.reply(getText(lang, 'question2'), {
    reply_markup: { force_reply: true, selective: true },
  });
}

export async function handleServiceBudget(ctx) {
  const lang = ctx.session?.language || 'uz';
  ctx.session.budget = ctx.message.text;
  ctx.session.step = 3;

  await ctx.reply(getText(lang, 'question3'), {
    reply_markup: { force_reply: true, selective: true },
  });
}

export async function handleServiceAdditional(ctx, bot, ADMIN_IDS) {
  const lang       = ctx.session?.language || 'uz';
  const additional = ctx.message.text;
  const category   = ctx.session.category;

  try {
    const fullDesc = [
      `📝 Tavsif: ${ctx.session.description}`,
      `📎 Qo'shimcha: ${additional}`,
    ].join('\n');

    const order = addOrder(ctx.from.id, category, fullDesc, ctx.session.budget);

    // Foydalanuvchiga xabar
    await ctx.reply(
      `${getText(lang, 'order_sent')}\n\n` +
      `📋 Buyurtma #${order?.id}\n` +
      `🏷️ Yo'nalish: ${SERVICES[category]?.name || category}\n` +
      `💰 Byudjet: ${ctx.session.budget}`,
      getMainKeyboard(lang)
    );

    // Adminlarga xabar
    const name    = ctx.from.first_name || '';
    const uname   = ctx.from.username ? `@${ctx.from.username}` : `ID:${ctx.from.id}`;
    const adminMsg =
      `🔔 *YANGI BUYURTMA #${order?.id}*\n\n` +
      `👤 Foydalanuvchi: ${name} ${uname}\n` +
      `🏷️ Yo'nalish: ${SERVICES[category]?.name || category}\n` +
      `📝 ${ctx.session.description}\n` +
      `📎 ${additional}\n` +
      `💰 Byudjet: ${ctx.session.budget}\n` +
      `📅 Vaqt: ${new Date().toLocaleString('uz-UZ')}`;

    for (const adminId of ADMIN_IDS) {
      try {
        await bot.telegram.sendMessage(adminId, adminMsg, {
          parse_mode: 'Markdown',
          ...getOrderStatusKeyboard(order?.id),
        });
      } catch (e) {
        logger.warn(`Admin ${adminId} ga xabar yuborishda xato: ${e.message}`);
      }
    }

    // Session tozalash
    ctx.session.step        = 0;
    ctx.session.category    = null;
    ctx.session.description = null;
    ctx.session.budget      = null;

    logger.info(`Order #${order?.id} created by user ${ctx.from.id}`);
  } catch (error) {
    logger.error(`Order error: ${error.message}`);
    await ctx.reply('❌ Xato yuz berdi. Qayta urinib ko\'ring.');
  }
}
