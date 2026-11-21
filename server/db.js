const path = require('path');
const fs = require('fs');
const os = require('os');
const Database = require('better-sqlite3');

function getDatabasePath() {
  let dbDir;
  if (process.env.KRS_DATA_DIR) {
    dbDir = process.env.KRS_DATA_DIR;
  } else if (process.platform === 'darwin') {
    dbDir = path.join(os.homedir(), 'Library', 'Application Support', 'KRS_Billing');
  } else if (process.platform === 'win32') {
    dbDir = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'KRS_Billing');
  } else {
    dbDir = path.join(os.homedir(), '.krs_billing');
  }

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  return path.join(dbDir, 'krs_banana_billing.db');
}

// APP_ENV controls demo data seeding:
//   production / prod -> real shop deployment (no sample customers)
//   test / development -> demo customers are seeded into empty databases
const APP_ENV = (process.env.KRS_ENV || process.env.NODE_ENV || 'development').toLowerCase();
const isProduction = APP_ENV === 'production' || APP_ENV === 'prod';

const dbPath = getDatabasePath();
console.log('[SQLite] Database location:', dbPath);
console.log(
  `[SQLite] Environment: ${APP_ENV}` +
    (isProduction ? ' (production: demo customer seeding disabled)' : ' (demo data enabled)')
);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  // 1. banana_types table
  db.exec(`
    CREATE TABLE IF NOT EXISTS banana_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_en TEXT NOT NULL,
      name_ml TEXT NOT NULL,
      default_rate_per_kg REAL NOT NULL,
      default_stem_waste_per_bunch_kg REAL NOT NULL
    );
  `);

  // 2. customers table (Permanent Customers)
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      shop_name TEXT,
      phone TEXT,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 3. temp_walkin_customers (Temporary Staging Table)
  db.exec(`
    CREATE TABLE IF NOT EXISTS temp_walkin_customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE,
      name TEXT,
      shop_name TEXT,
      visit_count INTEGER DEFAULT 1,
      total_spent REAL DEFAULT 0,
      first_visit_date DATETIME,
      last_visit_date DATETIME
    );
  `);

  // 4. bills table
  db.exec(`
    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_number TEXT UNIQUE NOT NULL,
      customer_type TEXT NOT NULL, -- 'permanent' | 'walkin'
      customer_id INTEGER,
      temp_walkin_id INTEGER,
      customer_display_name TEXT,
      customer_phone TEXT,
      date DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_gross_weight REAL NOT NULL,
      total_waste_weight REAL NOT NULL,
      total_net_weight REAL NOT NULL,
      grand_total REAL NOT NULL,
      amount_paid REAL NOT NULL DEFAULT 0,
      advance_adjusted REAL NOT NULL DEFAULT 0,
      advance_balance REAL NOT NULL DEFAULT 0,
      previous_balance REAL NOT NULL DEFAULT 0,
      old_dues_paid REAL NOT NULL DEFAULT 0,
      FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL,
      FOREIGN KEY(temp_walkin_id) REFERENCES temp_walkin_customers(id) ON DELETE SET NULL
    );
  `);

  // 5. bill_items table
  db.exec(`
    CREATE TABLE IF NOT EXISTS bill_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER NOT NULL,
      banana_type_id INTEGER NOT NULL,
      bunch_quantity INTEGER NOT NULL,
      gross_weight_kg REAL NOT NULL,
      waste_per_bunch_kg REAL NOT NULL,
      total_waste_kg REAL NOT NULL,
      net_weight_kg REAL NOT NULL,
      rate_per_kg REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY(bill_id) REFERENCES bills(id) ON DELETE CASCADE,
      FOREIGN KEY(banana_type_id) REFERENCES banana_types(id)
    );
  `);

  // 6. settings table (key/value configuration such as the WhatsApp owner number)
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );
  `);

  // 7. customer_ledger_entries (manual payments & adjustments)
  // Bills are derived automatically from the bills table, so a ledger is the
  // combination of: opening balance + active bills (debit) + manual entries.
  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_ledger_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      entry_type TEXT NOT NULL DEFAULT 'payment', -- 'payment' | 'adjustment'
      direction TEXT NOT NULL DEFAULT 'credit',   -- 'credit' reduces due | 'debit' increases due
      amount REAL NOT NULL,
      entry_date TEXT NOT NULL,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ledger_customer_date
    ON customer_ledger_entries (customer_id, entry_date);
  `);

  // Auto-migrate any existing Nendran references to Ethan / ഏത്തൻ
  db.prepare(`
    UPDATE banana_types 
    SET name_en = 'Ethan', name_ml = 'ഏത്തൻ' 
    WHERE name_en = 'Nendran' OR name_ml = 'നേന്ത്രൻ'
  `).run();

  // Seed default Kerala Banana Varieties if table is empty
  const bananaCount = db.prepare('SELECT COUNT(*) as count FROM banana_types').get().count;
  if (bananaCount === 0) {
    console.log('[SQLite] Seeding 5 Kerala Banana Varieties (Ethan, Robusta, etc.)...');
    const insertBanana = db.prepare(`
      INSERT INTO banana_types (name_en, name_ml, default_rate_per_kg, default_stem_waste_per_bunch_kg)
      VALUES (?, ?, ?, ?)
    `);

    const defaultVarieties = [
      { name_en: 'Ethan', name_ml: 'ഏത്തൻ', rate: 48.0, waste: 0.50 },
      { name_en: 'Robusta', name_ml: 'റോബസ്റ്റ', rate: 30.0, waste: 0.60 },
      { name_en: 'Poovan', name_ml: 'പൂവൻ', rate: 36.0, waste: 0.40 },
      { name_en: 'Njalipoovan', name_ml: 'ഞാലിപ്പൂവൻ', rate: 52.0, waste: 0.35 },
      { name_en: 'Palayankodan', name_ml: 'പാളയൻകോടൻ', rate: 24.0, waste: 0.45 },
    ];

    const insertMany = db.transaction((varieties) => {
      for (const v of varieties) {
        insertBanana.run(v.name_en, v.name_ml, v.rate, v.waste);
      }
    });
    insertMany(defaultVarieties);
  }

  // Demo customers are only for development/test databases.
  // A production shop always starts with an empty customer directory.
  if (!isProduction) {
    // Seed 2 Permanent Customers if empty
    const customerCount = db.prepare('SELECT COUNT(*) as count FROM customers').get().count;
    if (customerCount === 0) {
      console.log('[SQLite] Seeding sample Permanent Customers...');
      const insertCustomer = db.prepare(`
        INSERT INTO customers (name, shop_name, phone, address)
        VALUES (?, ?, ?, ?)
      `);
      insertCustomer.run('Ananthu K.', 'Ananthu Supermarket', '9847123456', 'Market Road, Alappuzha');
      insertCustomer.run('Usman Haji', 'Malabar Fresh Fruits', '9447654321', 'Big Bazaar, Alappuzha');
    }

    // Seed Frequent Walk-In Customers if empty
    const walkinCount = db.prepare('SELECT COUNT(*) as count FROM temp_walkin_customers').get().count;
    if (walkinCount === 0) {
      console.log('[SQLite] Seeding sample Walk-In Customers with frequent visits...');
      const insertWalkin = db.prepare(`
        INSERT INTO temp_walkin_customers (phone, name, shop_name, visit_count, total_spent, first_visit_date, last_visit_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      // Buyer with 4 visits (3+ highlight)
      insertWalkin.run(
        '9745112233',
        'Suresh Kumar',
        'Suresh Chips & Bakery',
        4,
        18450.00,
        '2026-10-15 10:30:00',
        '2026-11-10 16:45:00'
      );
      // Buyer with 1 visit
      insertWalkin.run(
        '9895001122',
        'Manoj',
        'Town Fruit Stall',
        1,
        4200.00,
        '2026-11-12 09:15:00',
        '2026-11-12 09:15:00'
      );
    }
  } else {
    console.log('[SQLite] Production mode: skipping sample customers (real data only).');
  }
}

// Create tables and seed defaults on first run (idempotent)
initDatabase();

// Migration: add `status` column to `bills` if it doesn't exist
try {
  const cols = db.prepare("PRAGMA table_info('bills')").all();
  const hasStatus = cols.some(c => c.name === 'status');
  if (!hasStatus) {
    console.log('[SQLite] Adding missing `status` column to bills table');
    db.exec(`ALTER TABLE bills ADD COLUMN status TEXT NOT NULL DEFAULT 'active';`);
  }
} catch (e) {
  console.error('[SQLite] Migration error:', e);
}

// Migration: add opening-balance fields to `customers` if they don't exist
try {
  const cols = db.prepare("PRAGMA table_info('customers')").all();
  if (!cols.some(c => c.name === 'opening_balance')) {
    console.log('[SQLite] Adding missing `opening_balance` column to customers table');
    db.exec(`ALTER TABLE customers ADD COLUMN opening_balance REAL NOT NULL DEFAULT 0;`);
  }
  if (!cols.some(c => c.name === 'opening_balance_date')) {
    console.log('[SQLite] Adding missing `opening_balance_date` column to customers table');
    db.exec(`ALTER TABLE customers ADD COLUMN opening_balance_date TEXT;`);
  }
} catch (e) {
  console.error('[SQLite] Opening-balance migration error:', e);
}

// Migration: add `amount_paid` and `advance_adjusted` to `bills` if missing
try {
  const cols = db.prepare("PRAGMA table_info('bills')").all();
  if (!cols.some(c => c.name === 'amount_paid')) {
    console.log('[SQLite] Adding missing `amount_paid` column to bills table');
    db.exec(`ALTER TABLE bills ADD COLUMN amount_paid REAL NOT NULL DEFAULT 0;`);
  }
  if (!cols.some(c => c.name === 'advance_adjusted')) {
    console.log('[SQLite] Adding missing `advance_adjusted` column to bills table');
    db.exec(`ALTER TABLE bills ADD COLUMN advance_adjusted REAL NOT NULL DEFAULT 0;`);
  }
  if (!cols.some(c => c.name === 'advance_balance')) {
    console.log('[SQLite] Adding missing `advance_balance` column to bills table');
    db.exec(`ALTER TABLE bills ADD COLUMN advance_balance REAL NOT NULL DEFAULT 0;`);
  }
  if (!cols.some(c => c.name === 'previous_balance')) {
    console.log('[SQLite] Adding missing `previous_balance` column to bills table');
    db.exec(`ALTER TABLE bills ADD COLUMN previous_balance REAL NOT NULL DEFAULT 0;`);
  }
  if (!cols.some(c => c.name === 'old_dues_paid')) {
    console.log('[SQLite] Adding missing `old_dues_paid` column to bills table');
    db.exec(`ALTER TABLE bills ADD COLUMN old_dues_paid REAL NOT NULL DEFAULT 0;`);
  }
} catch (e) {
  console.error('[SQLite] Bill amount-paid migration error:', e);
}


// ---------------------------------------------------------------
// Settings helpers (small key/value configuration store)
// ---------------------------------------------------------------
const SETTING_DEFAULTS = {
  whatsapp_owner_number: '',
  whatsapp_message_template:
    'KRS Plantain Merchant & Commission Agent\nBill {bill_number}\nAmount: {amount}\nPlease find the attached PDF bill.\nThank you!',
  upi_id: 'Vyapar.178760240373@hdfcbank',
  whatsapp_enabled: 'true',
  qr_enabled: 'true'
};

function getSetting(key, fallback = '') {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : (key in SETTING_DEFAULTS ? SETTING_DEFAULTS[key] : fallback);
}

function getAllSettings() {
  const result = { ...SETTING_DEFAULTS };
  for (const row of db.prepare('SELECT key, value FROM settings').all()) {
    result[row.key] = row.value;
  }
  return result;
}

function setSetting(key, value) {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, String(value == null ? '' : value));
}

module.exports = {
  db,
  dbPath,
  appEnv: APP_ENV,
  isProduction,
  getSetting,
  getAllSettings,
  setSetting
};
