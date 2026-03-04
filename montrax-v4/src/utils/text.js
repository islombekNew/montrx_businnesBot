// Utility helpers for working with text

/**
 * Escape Markdown special characters to prevent parsing errors.
 * This is written for Markdown parse mode (v1) used by the bot.
 * It will prefix characters that Telegram treats as markup with a backslash.
 */
export function escapeMarkdown(text = '') {
  return String(text).replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}
