#!/usr/bin/env node
/**
 * Remove the demo customers that development/test runs seeded into a database.
 *
 * Safe by default: prints what would be removed and changes nothing.
 * Pass --yes to actually delete. Bills are never deleted; if a demo customer
 * is referenced by a bill, only the customer link is cleared (ON DELETE SET NULL)
 * and the invoice keeps its stored display name.
 *
 * Usage:
 *   npm run clean:demo                                  # preview
 *   npm run clean:demo -- --yes                         # delete
 *   KRS_DATA_DIR="/path/to/db-folder" npm run clean:demo
 */
process.env.KRS_ENV = process.env.KRS_ENV || 'production';

const { db, dbPath, appEnv } = require('../server/db');

const APPLY = process.argv.includes('--yes') || process.argv.includes('-y');

// Exact name + phone pairs created by server/db.js demo seeding.
const DEMO_PERMANENT = [
  { name: 'Ananthu K.', phone: '9847123456' },
  { name: 'Usman Haji', phone: '9447654321' },
  // Promoted from the seeded walk-in customer.
  { name: 'Suresh Kumar', phone: '9745112233' },
];

const DEMO_WALKINS = [
  { name: 'Suresh Kumar', phone: '9745112233' },
  { name: 'Manoj', phone: '9895001122' },
];

function findMatches(table, demoRows) {
  const seen = new Set();
  const matches = [];

  for (const demo of demoRows) {
    const rows = db
      .prepare(`SELECT * FROM ${table} WHERE phone = ? AND name = ?`)
      .all(demo.phone, demo.name);

    for (const row of rows) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        matches.push(row);
      }
    }
  }

  return matches;
}

function billCountForPermanent(id) {
  return db.prepare('SELECT COUNT(*) AS count FROM bills WHERE customer_id = ?').get(id).count;
}

function billCountForWalkin(id) {
  return db.prepare('SELECT COUNT(*) AS count FROM bills WHERE temp_walkin_id = ?').get(id).count;
}

function main() {
  console.log('[clean-demo] Environment:', appEnv);
  console.log('[clean-demo] Database:', dbPath);
  console.log(`[clean-demo] Mode: ${APPLY ? 'DELETE' : 'DRY RUN (pass --yes to delete)'}`);

  const permanent = findMatches('customers', DEMO_PERMANENT);
  const walkins = findMatches('temp_walkin_customers', DEMO_WALKINS);

  if (permanent.length === 0 && walkins.length === 0) {
    console.log('[clean-demo] No seeded demo customers found. Nothing to do.');
    return;
  }

  if (permanent.length > 0) {
    console.log(`\n[clean-demo] Demo permanent customers (${permanent.length}):`);
    for (const customer of permanent) {
      const bills = billCountForPermanent(customer.id);
      console.log(
        `  - #${customer.id} ${customer.name} / ${customer.shop_name || '—'} (${customer.phone})` +
          (bills ? ` — ${bills} bill(s) kept, customer link cleared` : '')
      );
    }
  }

  if (walkins.length > 0) {
    console.log(`\n[clean-demo] Demo walk-in customers (${walkins.length}):`);
    for (const walkin of walkins) {
      const bills = billCountForWalkin(walkin.id);
      console.log(
        `  - #${walkin.id} ${walkin.name || '(no name)'} (${walkin.phone})` +
          (bills ? ` — ${bills} bill(s) kept, customer link cleared` : '')
      );
    }
  }

  if (!APPLY) {
    console.log('\n[clean-demo] Nothing was changed. Run again with --yes to delete these rows.');
    return;
  }

  const removeDemoData = db.transaction(() => {
    const deleteCustomer = db.prepare('DELETE FROM customers WHERE id = ?');
    const deleteWalkin = db.prepare('DELETE FROM temp_walkin_customers WHERE id = ?');

    for (const customer of permanent) deleteCustomer.run(customer.id);
    for (const walkin of walkins) deleteWalkin.run(walkin.id);
  });

  removeDemoData();

  console.log(
    `\n[clean-demo] Removed ${permanent.length} permanent and ${walkins.length} walk-in demo customer(s).`
  );
  console.log('[clean-demo] All bills and real customers were left untouched.');
}

try {
  main();
} catch (error) {
  console.error('[clean-demo] Failed:', error.message);
  process.exit(1);
}
