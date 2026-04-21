const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../utils/config');
const logger = require('../utils/logger');

let db = null;

function getDb() {
  if (db) return db;

  const dbPath = config.databaseUrl;
  const dbDir = path.dirname(dbPath);

  if (dbDir && !fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);

  logger.info({ database: dbPath }, 'Database connected');
  return db;
}

function initializeDatabase() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      subaddress TEXT NOT NULL,
      subaddress_index INTEGER,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'confirmed', 'expired')),
      confirmations INTEGER DEFAULT 0,
      tx_hash TEXT,
      expires_at INTEGER NOT NULL,
      paid_at INTEGER,
      confirmed_at INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_invoices_subaddress ON invoices(subaddress);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
    CREATE INDEX IF NOT EXISTS idx_invoices_expires_at ON invoices(expires_at);

    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      label TEXT,
      active INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_key_id INTEGER,
      url TEXT NOT NULL,
      events TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      secret TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (api_key_id) REFERENCES api_keys(id)
    );

    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      webhook_id INTEGER,
      invoice_id TEXT,
      event TEXT NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      response_code INTEGER,
      error TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (webhook_id) REFERENCES webhooks(id),
      FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    );
  `);

  logger.info('Database tables initialized');

  if (config.apiKeys.length > 0) {
    const insertKey = db.prepare('INSERT OR IGNORE INTO api_keys (key, label) VALUES (?, ?)');
    config.apiKeys.forEach((key, idx) => {
      insertKey.run(key, `Key ${idx + 1}`);
    });
    logger.info({ count: config.apiKeys.length }, 'API keys seeded');
  }
}

module.exports = {
  getDb,
  initializeDatabase
};
