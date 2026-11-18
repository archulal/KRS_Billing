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

const dbPath = getDatabasePath();
console.log('[SQLite] Database location:', dbPath);

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
}

initDatabase();

module.exports = {
  db,
  dbPath
};
