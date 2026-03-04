/**
 * SQLite Database Service
 * better-sqlite3 — sinxron, tez, ishonchli
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(process.cwd(), process.env.DATA_DIR || './data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'montrax.db');
let db;

// ─── INIT ────────────────────────────────────────────────────────────────────

export function initializeDatabase() {
  try {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');   // Tez yozish
    db.pragma('foreign_keys = ON');    // FK cheklovlar
    db.pragma('synchronous = NORMAL'); // Balans: xavfsiz + tez

    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id     INTEGER UNIQUE NOT NULL,
        username        TEXT,
        first_name      TEXT,
        language        TEXT DEFAULT 'uz',
        is_premium      INTEGER DEFAULT 0,
        premium_expires TEXT,
        stars_balance   INTEGER DEFAULT 0,
        is_banned       INTEGER DEFAULT 0,
        ban_reason      TEXT,
        referral_code   TEXT UNIQUE,
        referred_by     INTEGER,
        referral_count  INTEGER DEFAULT 0,
        total_spent     INTEGER DEFAULT 0,
        created_at      TEXT DEFAULT (datetime('now')),
        updated_at      TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS orders (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER NOT NULL,
        category    TEXT NOT NULL,
        description TEXT,
        budget      TEXT,
        status      TEXT DEFAULT 'pending',
        admin_note  TEXT,
        created_at  TEXT DEFAULT (datetime('now')),
        updated_at  TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS payments (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id        INTEGER NOT NULL,
        amount         INTEGER NOT NULL,
        currency       TEXT DEFAULT 'UZS',
        payment_method TEXT,
        status         TEXT DEFAULT 'pending',
        payload        TEXT,
        transaction_id TEXT,
        created_at     TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS admins (
        telegram_id INTEGER PRIMARY KEY,
        added_by    INTEGER,
        added_at    TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
      CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
    `);

    logger.info('✅ SQLite database initialized');

    // Ensure environment defaults for required channel/group are stored in settings
    const rc = process.env.REQUIRED_CHANNEL || '';
    const rg = process.env.REQUIRED_GROUP || '';
    if (rc) {
      const existing = db.prepare('SELECT value FROM settings WHERE key = ?').get('required_channel');
      if (!existing || !existing.value) {
        setSetting('required_channel', rc);
        logger.info('🔧 Default required channel set from ENV:', rc);
      }
    }
    if (rg) {
      const existingg = db.prepare('SELECT value FROM settings WHERE key = ?').get('required_group');
      if (!existingg || !existingg.value) {
        setSetting('required_group', rg);
        logger.info('🔧 Default required group set from ENV:', rg);
      }
    }

    return db;
  } catch (error) {
    logger.error('❌ Database init error:', error);
    throw error;
  }
}

function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

// ─── USERS ───────────────────────────────────────────────────────────────────

export function upsertUser(telegramId, data = {}) {
  const d = getDb();
  const referralCode = generateReferralCode(telegramId);

  const existing = d.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);

  if (existing) {
    d.prepare(`
      UPDATE users SET
        username   = COALESCE(?, username),
        first_name = COALESCE(?, first_name),
        language   = COALESCE(?, language),
        updated_at = datetime('now')
      WHERE telegram_id = ?
    `).run(data.username || null, data.first_name || null, data.language || null, telegramId);
    return d.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
  } else {
    d.prepare(`
      INSERT INTO users (telegram_id, username, first_name, language, referral_code, referred_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      telegramId,
      data.username || null,
      data.first_name || null,
      data.language || 'uz',
      referralCode,
      data.referred_by || null
    );

    // Referral bonusi
    if (data.referred_by) {
      d.prepare('UPDATE users SET referral_count = referral_count + 1 WHERE telegram_id = ?')
        .run(data.referred_by);
    }

    return d.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
  }
}

export function getUser(telegramId) {
  return getDb().prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId) || null;
}

export function getAllUsers() {
  return getDb().prepare('SELECT * FROM users ORDER BY created_at DESC').all();
}

export function banUser(telegramId, reason = '') {
  return getDb().prepare('UPDATE users SET is_banned = 1, ban_reason = ? WHERE telegram_id = ?')
    .run(reason, telegramId);
}

export function unbanUser(telegramId) {
  return getDb().prepare('UPDATE users SET is_banned = 0, ban_reason = NULL WHERE telegram_id = ?')
    .run(telegramId);
}

export function addStars(telegramId, amount) {
  return getDb().prepare('UPDATE users SET stars_balance = stars_balance + ? WHERE telegram_id = ?')
    .run(amount, telegramId);
}

export function upgradePremium(telegramId, months = 1) {
  const now = new Date();
  now.setMonth(now.getMonth() + months);
  return getDb().prepare(`
    UPDATE users SET is_premium = 1, premium_expires = ?, updated_at = datetime('now')
    WHERE telegram_id = ?
  `).run(now.toISOString(), telegramId);
}

export function getUserByReferralCode(code) {
  return getDb().prepare('SELECT * FROM users WHERE referral_code = ?').get(code) || null;
}

// ─── ORDERS ──────────────────────────────────────────────────────────────────

export function addOrder(telegramId, category, description, budget) {
  const d = getDb();
  const user = getUser(telegramId);
  if (!user) return null;

  const result = d.prepare(`
    INSERT INTO orders (user_id, category, description, budget)
    VALUES (?, ?, ?, ?)
  `).run(user.id, category, description, budget);

  return d.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);
}

export function getOrderById(orderId) {
  return getDb().prepare('SELECT * FROM orders WHERE id = ?').get(orderId) || null;
}

export function getUserOrders(telegramId) {
  const d = getDb();
  const user = getUser(telegramId);
  if (!user) return [];
  return d.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
}

export function getAllOrders(status = null) {
  const d = getDb();
  if (status) {
    return d.prepare(`
      SELECT o.*, u.telegram_id, u.username, u.first_name
      FROM orders o JOIN users u ON o.user_id = u.id
      WHERE o.status = ? ORDER BY o.created_at DESC
    `).all(status);
  }
  return d.prepare(`
    SELECT o.*, u.telegram_id, u.username, u.first_name
    FROM orders o JOIN users u ON o.user_id = u.id
    ORDER BY o.created_at DESC
  `).all();
}

export function updateOrderStatus(orderId, status, adminNote = '') {
  return getDb().prepare(`
    UPDATE orders SET status = ?, admin_note = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(status, adminNote, orderId);
}

// ─── PAYMENTS ────────────────────────────────────────────────────────────────

export function addPayment(telegramId, amount, method, payload = '') {
  const d = getDb();
  const user = getUser(telegramId);
  if (!user) return null;

  const result = d.prepare(`
    INSERT INTO payments (user_id, amount, payment_method, payload, status)
    VALUES (?, ?, ?, ?, 'completed')
  `).run(user.id, amount, method, payload);

  // Jami sarflangan summani yangilash
  d.prepare('UPDATE users SET total_spent = total_spent + ? WHERE telegram_id = ?')
    .run(amount, telegramId);

  return d.prepare('SELECT * FROM payments WHERE id = ?').get(result.lastInsertRowid);
}

export function getUserPayments(telegramId) {
  const d = getDb();
  const user = getUser(telegramId);
  if (!user) return [];
  return d.prepare('SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
}

export function getAllPayments() {
  return getDb().prepare(`
    SELECT p.*, u.telegram_id, u.username, u.first_name
    FROM payments p JOIN users u ON p.user_id = u.id
    ORDER BY p.created_at DESC LIMIT 100
  `).all();
}

// ─── STATS ───────────────────────────────────────────────────────────────────

export function getStats() {
  const d = getDb();
  const totalUsers     = d.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const premiumUsers   = d.prepare("SELECT COUNT(*) as c FROM users WHERE is_premium = 1").get().c;
  const bannedUsers    = d.prepare("SELECT COUNT(*) as c FROM users WHERE is_banned = 1").get().c;
  const totalOrders    = d.prepare('SELECT COUNT(*) as c FROM orders').get().c;
  const pendingOrders  = d.prepare("SELECT COUNT(*) as c FROM orders WHERE status='pending'").get().c;
  const doneOrders     = d.prepare("SELECT COUNT(*) as c FROM orders WHERE status='done'").get().c;
  const totalRevenue   = d.prepare("SELECT COALESCE(SUM(amount),0) as s FROM payments").get().s;
  const todayUsers     = d.prepare("SELECT COUNT(*) as c FROM users WHERE date(created_at)=date('now')").get().c;
  const todayOrders    = d.prepare("SELECT COUNT(*) as c FROM orders WHERE date(created_at)=date('now')").get().c;

  return { totalUsers, premiumUsers, bannedUsers, totalOrders, pendingOrders, doneOrders, totalRevenue, todayUsers, todayOrders };
}

// ─── SETTINGS ────────────────────────────────────────────────────────────────

export function getSetting(key) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

export function setSetting(key, value) {
  getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, String(value || ''));
}

export function getRequiredChannel() {
  return getSetting('required_channel') || process.env.REQUIRED_CHANNEL || null;
}

export function getRequiredGroup() {
  return getSetting('required_group') || process.env.REQUIRED_GROUP || null;
}

export function setRequiredChannel(val) { setSetting('required_channel', val); }
export function setRequiredGroup(val)   { setSetting('required_group', val); }
export function clearRequiredChannel()  { setSetting('required_channel', ''); }
export function clearRequiredGroup()    { setSetting('required_group', ''); }

// ─── ADMINS ──────────────────────────────────────────────────────────────────

export function getAdminsFromDb() {
  return getDb().prepare('SELECT telegram_id FROM admins').all().map(r => r.telegram_id);
}

export function addAdminId(telegramId, addedBy = null) {
  getDb().prepare('INSERT OR IGNORE INTO admins (telegram_id, added_by) VALUES (?, ?)').run(telegramId, addedBy);
}

export function removeAdminId(telegramId) {
  getDb().prepare('DELETE FROM admins WHERE telegram_id = ?').run(telegramId);
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function generateReferralCode(telegramId) {
  return `MX${telegramId.toString(36).toUpperCase()}`;
}

export function getUserFullHistory(telegramId) {
  const user = getUser(telegramId);
  if (!user) return null;
  return {
    user,
    orders: getUserOrders(telegramId),
    payments: getUserPayments(telegramId),
  };
}

export default { initializeDatabase };
