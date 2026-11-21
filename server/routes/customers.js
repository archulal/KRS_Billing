const express = require('express');
const router = express.Router();
const { db } = require('../db');

// ---------------------------------------------------------------
// Ledger helpers
// ---------------------------------------------------------------
function parseAmount(value) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function toDateOnly(value) {
  if (!value) return null;
  const s = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function todayLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Outstanding = opening + active bills + debit adjustments
//               - manual credits - payments recorded at POS on active bills
function getOutstanding(customerId) {
  const customer = db.prepare('SELECT opening_balance FROM customers WHERE id = ?').get(customerId);
  if (!customer) return null;

  const billed = db.prepare(`
    SELECT COALESCE(SUM(grand_total), 0) AS total
    FROM bills
    WHERE customer_id = ? AND status = 'active'
  `).get(customerId).total;

  const billPaid = db.prepare(`
    SELECT COALESCE(SUM(amount_paid), 0) AS total
    FROM bills
    WHERE customer_id = ? AND status = 'active'
  `).get(customerId).total;

  const manual = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN direction = 'debit' THEN amount ELSE -amount END), 0) AS total
    FROM customer_ledger_entries
    WHERE customer_id = ?
  `).get(customerId).total;

  return Math.round((parseAmount(customer.opening_balance) + billed + manual - billPaid) * 100) / 100;
}

// GET all permanent customers (with optional search query)
router.get('/', (req, res) => {
  try {
    const { search } = req.query;
    let query = `
      SELECT c.*,
        ROUND(
          COALESCE(c.opening_balance, 0)
          + COALESCE((SELECT SUM(b.grand_total) FROM bills b WHERE b.customer_id = c.id AND b.status = 'active'), 0)
          - COALESCE((SELECT SUM(b.amount_paid) FROM bills b WHERE b.customer_id = c.id AND b.status = 'active'), 0)
          + COALESCE((SELECT SUM(CASE WHEN e.direction = 'debit' THEN e.amount ELSE 0 END) FROM customer_ledger_entries e WHERE e.customer_id = c.id), 0)
          - COALESCE((SELECT SUM(CASE WHEN e.direction = 'credit' THEN e.amount ELSE 0 END) FROM customer_ledger_entries e WHERE e.customer_id = c.id), 0)
        , 2) AS outstanding
      FROM customers c
    `;
    const params = [];

    if (search && search.trim()) {
      query += ` WHERE c.name LIKE ? OR c.shop_name LIKE ? OR c.phone LIKE ?`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY c.name ASC';
    const customers = db.prepare(query).all(...params);
    res.json(customers);
  } catch (err) {
    console.error('Error fetching permanent customers:', err);
    res.status(500).json({ error: 'Failed to fetch permanent customers' });
  }
});

// POST add permanent customer
router.post('/', (req, res) => {
  try {
    const { name, shop_name, phone, address } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    const stmt = db.prepare(`
      INSERT INTO customers (name, shop_name, phone, address, opening_balance, opening_balance_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      name.trim(),
      (shop_name || '').trim(),
      (phone || '').trim(),
      (address || '').trim(),
      parseAmount(req.body.opening_balance),
      toDateOnly(req.body.opening_balance_date)
    );

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ ...customer, outstanding: getOutstanding(customer.id) });
  } catch (err) {
    console.error('Error creating permanent customer:', err);
    res.status(500).json({ error: 'Failed to create permanent customer' });
  }
});

// PUT update permanent customer
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, shop_name, phone, address } = req.body;

    const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Opening balance is managed from the ledger panel; keep it when the
    // regular edit form does not send it.
    const openingBalance = req.body.opening_balance !== undefined
      ? parseAmount(req.body.opening_balance)
      : existing.opening_balance;
    const openingDate = req.body.opening_balance_date !== undefined
      ? toDateOnly(req.body.opening_balance_date)
      : existing.opening_balance_date;

    const stmt = db.prepare(`
      UPDATE customers
      SET name = ?, shop_name = ?, phone = ?, address = ?, opening_balance = ?, opening_balance_date = ?
      WHERE id = ?
    `);

    stmt.run(
      (name || '').trim(),
      (shop_name || '').trim(),
      (phone || '').trim(),
      (address || '').trim(),
      openingBalance,
      openingDate,
      id
    );

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    res.json({ ...customer, outstanding: getOutstanding(id) });
  } catch (err) {
    console.error('Error updating customer:', err);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// DELETE permanent customer
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    res.json({ success: true, message: 'Customer deleted' });
  } catch (err) {
    console.error('Error deleting customer:', err);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

// GET all temporary walk-in customers sorted by visit_count DESC
router.get('/walkin', (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM temp_walkin_customers';
    const params = [];

    if (search && search.trim()) {
      query += ` WHERE name LIKE ? OR shop_name LIKE ? OR phone LIKE ?`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY visit_count DESC, total_spent DESC';
    const walkins = db.prepare(query).all(...params);
    res.json(walkins);
  } catch (err) {
    console.error('Error fetching walk-in customers:', err);
    res.status(500).json({ error: 'Failed to fetch walk-in customers' });
  }
});

// POST upsert temporary walk-in customer
router.post('/walkin/upsert', (req, res) => {
  try {
    const { phone, name, shop_name, bill_amount } = req.body;
    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: 'Phone number is required for walk-in tracking' });
    }

    const cleanPhone = phone.trim();
    const cleanName = (name || '').trim();
    const cleanShop = (shop_name || '').trim();
    const amount = parseFloat(bill_amount) || 0;

    const existing = db.prepare('SELECT * FROM temp_walkin_customers WHERE phone = ?').get(cleanPhone);

    if (existing) {
      const updateStmt = db.prepare(`
        UPDATE temp_walkin_customers
        SET visit_count = visit_count + 1,
            total_spent = total_spent + ?,
            name = CASE WHEN ? != '' THEN ? ELSE name END,
            shop_name = CASE WHEN ? != '' THEN ? ELSE shop_name END,
            last_visit_date = datetime('now')
        WHERE id = ?
      `);
      updateStmt.run(amount, cleanName, cleanName, cleanShop, cleanShop, existing.id);
      const updated = db.prepare('SELECT * FROM temp_walkin_customers WHERE id = ?').get(existing.id);
      return res.json(updated);
    } else {
      const insertStmt = db.prepare(`
        INSERT INTO temp_walkin_customers (phone, name, shop_name, visit_count, total_spent, first_visit_date, last_visit_date)
        VALUES (?, ?, ?, 1, ?, datetime('now'), datetime('now'))
      `);
      const result = insertStmt.run(cleanPhone, cleanName, cleanShop, amount);
      const inserted = db.prepare('SELECT * FROM temp_walkin_customers WHERE id = ?').get(result.lastInsertRowid);
      return res.status(201).json(inserted);
    }
  } catch (err) {
    console.error('Error upserting walk-in customer:', err);
    res.status(500).json({ error: 'Failed to upsert walk-in customer' });
  }
});

// POST 1-Click Promote to Permanent Customer
router.post('/walkin/promote/:id', (req, res) => {
  const { id } = req.params;
  const promoteTransaction = db.transaction(() => {
    const temp = db.prepare('SELECT * FROM temp_walkin_customers WHERE id = ?').get(id);
    if (!temp) {
      throw new Error('Temporary walk-in record not found');
    }

    // Insert into permanent customers
    const insertPerm = db.prepare(`
      INSERT INTO customers (name, shop_name, phone, address)
      VALUES (?, ?, ?, ?)
    `);

    const customerName = temp.name || temp.shop_name || `Walk-in (${temp.phone})`;
    const result = insertPerm.run(customerName, temp.shop_name || '', temp.phone || '', '');
    const newCustomerId = result.lastInsertRowid;

    // Update existing bills linked to this temp_walkin_id to point to the new customer
    db.prepare(`
      UPDATE bills
      SET customer_type = 'permanent',
          customer_id = ?,
          temp_walkin_id = NULL
      WHERE temp_walkin_id = ?
    `).run(newCustomerId, id);

    // Delete from temp_walkin_customers
    db.prepare('DELETE FROM temp_walkin_customers WHERE id = ?').run(id);

    return db.prepare('SELECT * FROM customers WHERE id = ?').get(newCustomerId);
  });

  try {
    const promotedCustomer = promoteTransaction();
    res.json({
      success: true,
      message: 'Successfully promoted to Permanent Customer',
      customer: promotedCustomer
    });
  } catch (err) {
    console.error('Error promoting walk-in customer:', err);
    res.status(500).json({ error: err.message || 'Failed to promote walk-in customer' });
  }
});

// ---------------------------------------------------------------
// GET /:id/ledger
// Running customer statement built from opening balance + active bills
// (debit) + manual payment/adjustment entries (credit/debit).
// Optional ?from=YYYY-MM-DD&to=YYYY-MM-DD filters the statement period.
// ---------------------------------------------------------------
router.get('/:id/ledger', (req, res) => {
  try {
    const customerId = parseInt(req.params.id, 10);
    if (!customerId) {
      return res.status(400).json({ error: 'Invalid customer id' });
    }

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const from = toDateOnly(req.query.from);
    const to = toDateOnly(req.query.to);
    const openingBalance = parseAmount(customer.opening_balance);

    // Balance brought forward from everything before the selected period.
    let carriedForward = openingBalance;
    if (from) {
      const billsBefore = db.prepare(`
        SELECT COALESCE(SUM(grand_total), 0) AS total
        FROM bills
        WHERE customer_id = ? AND status = 'active' AND date(date) < date(?)
      `).get(customerId, from).total;

      const entriesBefore = db.prepare(`
        SELECT COALESCE(SUM(CASE WHEN direction = 'credit' THEN -amount ELSE amount END), 0) AS total
        FROM customer_ledger_entries
        WHERE customer_id = ? AND date(entry_date) < date(?)
      `).get(customerId, from).total;

      carriedForward = Math.round((openingBalance + billsBefore + entriesBefore) * 100) / 100;
    }

    // Active bills in the period.
    const billConditions = [`customer_id = ?`, `status = 'active'`];
    const billParams = [customerId];
    if (from) {
      billConditions.push('date(date) >= date(?)');
      billParams.push(from);
    }
    if (to) {
      billConditions.push('date(date) <= date(?)');
      billParams.push(to);
    }

    const bills = db.prepare(`
      SELECT id, bill_number, date, grand_total, amount_paid
      FROM bills
      WHERE ${billConditions.join(' AND ')}
      ORDER BY date(date) ASC, id ASC
    `).all(...billParams);

    // Manual entries in the period.
    const entryConditions = ['customer_id = ?'];
    const entryParams = [customerId];
    if (from) {
      entryConditions.push('date(entry_date) >= date(?)');
      entryParams.push(from);
    }
    if (to) {
      entryConditions.push('date(entry_date) <= date(?)');
      entryParams.push(to);
    }

    const entries = db.prepare(`
      SELECT *
      FROM customer_ledger_entries
      WHERE ${entryConditions.join(' AND ')}
      ORDER BY date(entry_date) ASC, id ASC
    `).all(...entryParams);

    const activity = [
      ...bills.flatMap((b) => {
        const paid = parseAmount(b.amount_paid);
        const rows = [{
          kind: 'bill',
          sort_date: String(b.date || '').slice(0, 10),
          order: b.id * 2,
          ref_id: b.id,
          bill_number: b.bill_number,
          date: b.date,
          debit: parseAmount(b.grand_total),
          credit: 0
        }];

        // Amount collected at billing time is shown as a credit against the bill.
        if (paid > 0) {
          rows.push({
            kind: 'bill_payment',
            sort_date: String(b.date || '').slice(0, 10),
            order: b.id * 2 + 1,
            ref_id: b.id,
            bill_number: b.bill_number,
            date: b.date,
            debit: 0,
            credit: paid
          });
        }

        return rows;
      }),
      ...entries.map((e) => ({
        kind: e.entry_type === 'adjustment' ? 'adjustment' : 'payment',
        sort_date: String(e.entry_date || '').slice(0, 10),
        order: 1000000 + e.id,
        ref_id: e.id,
        entry_type: e.entry_type,
        direction: e.direction,
        note: e.note || '',
        date: e.entry_date,
        debit: e.direction === 'debit' ? parseAmount(e.amount) : 0,
        credit: e.direction === 'credit' ? parseAmount(e.amount) : 0
      }))
    ].sort((a, b) =>
      a.sort_date === b.sort_date
        ? (a.order - b.order) || (a.ref_id - b.ref_id)
        : a.sort_date.localeCompare(b.sort_date)
    );

    let runningBalance = carriedForward;
    const rows = [{
      kind: 'opening',
      ref_id: null,
      date: from || customer.opening_balance_date || '',
      debit: carriedForward > 0 ? carriedForward : 0,
      credit: carriedForward < 0 ? Math.abs(carriedForward) : 0,
      balance: carriedForward,
      note: ''
    }];

    let periodDebits = 0;
    let periodCredits = 0;

    for (const item of activity) {
      runningBalance = Math.round((runningBalance + item.debit - item.credit) * 100) / 100;
      periodDebits += item.debit;
      periodCredits += item.credit;
      rows.push({ ...item, balance: runningBalance });
    }

    const lifetimeBilled = db.prepare(`
      SELECT COALESCE(SUM(grand_total), 0) AS total
      FROM bills WHERE customer_id = ? AND status = 'active'
    `).get(customerId).total;

    const lifetimeBillsCount = db.prepare(`
      SELECT COUNT(*) AS count
      FROM bills WHERE customer_id = ? AND status = 'active'
    `).get(customerId).count;

    const lifetimeBillPayments = db.prepare(`
      SELECT COALESCE(SUM(amount_paid), 0) AS total
      FROM bills WHERE customer_id = ? AND status = 'active'
    `).get(customerId).total;

    const lifetimeManualCredits = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM customer_ledger_entries WHERE customer_id = ? AND direction = 'credit'
    `).get(customerId).total;

    const lifetimeCredits = Math.round((lifetimeBillPayments + lifetimeManualCredits) * 100) / 100;

    const lifetimeDebits = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM customer_ledger_entries WHERE customer_id = ? AND direction = 'debit'
    `).get(customerId).total;

    res.json({
      customer,
      period: { from, to },
      carried_forward: carriedForward,
      summary: {
        opening_balance: openingBalance,
        total_bills_amount: Math.round(periodDebits * 100) / 100,
        total_credits: Math.round(periodCredits * 100) / 100,
        closing_balance: runningBalance,
        bills_count: bills.length,
        entries_count: entries.length
      },
      lifetime: {
        total_billed: Math.round(lifetimeBilled * 100) / 100,
        total_paid: Math.round(lifetimeCredits * 100) / 100,
        total_debit_adjustments: Math.round(lifetimeDebits * 100) / 100,
        bills_count: lifetimeBillsCount,
        outstanding: Math.round((openingBalance + lifetimeBilled + lifetimeDebits - lifetimeCredits) * 100) / 100
      },
      entries: rows
    });
  } catch (err) {
    console.error('Error building customer ledger:', err);
    res.status(500).json({ error: 'Failed to build customer ledger' });
  }
});

// ---------------------------------------------------------------
// POST /:id/ledger/entries – record a payment or manual adjustment
// body: { entry_type: 'payment'|'adjustment', direction: 'credit'|'debit',
//         amount, entry_date, note }
// ---------------------------------------------------------------
router.post('/:id/ledger/entries', (req, res) => {
  try {
    const customerId = parseInt(req.params.id, 10);
    if (!customerId) {
      return res.status(400).json({ error: 'Invalid customer id' });
    }

    const customer = db.prepare('SELECT id FROM customers WHERE id = ?').get(customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const entryType = req.body.entry_type === 'adjustment' ? 'adjustment' : 'payment';
    let direction = req.body.direction === 'debit' ? 'debit' : 'credit';
    if (entryType === 'payment') direction = 'credit';

    const amount = parseAmount(req.body.amount);
    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than zero' });
    }

    const entryDate = toDateOnly(req.body.entry_date) || todayLocal();
    const note = (req.body.note || '').trim();

    const result = db.prepare(`
      INSERT INTO customer_ledger_entries
        (customer_id, entry_type, direction, amount, entry_date, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(customerId, entryType, direction, amount, entryDate, note);

    const entry = db.prepare('SELECT * FROM customer_ledger_entries WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ entry, outstanding: getOutstanding(customerId) });
  } catch (err) {
    console.error('Error recording ledger entry:', err);
    res.status(500).json({ error: 'Failed to record ledger entry' });
  }
});

// ---------------------------------------------------------------
// DELETE /:id/ledger/entries/:entryId – remove a manual entry
// ---------------------------------------------------------------
router.delete('/:id/ledger/entries/:entryId', (req, res) => {
  try {
    const customerId = parseInt(req.params.id, 10);
    const entryId = parseInt(req.params.entryId, 10);
    if (!customerId || !entryId) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const info = db.prepare(`
      DELETE FROM customer_ledger_entries WHERE id = ? AND customer_id = ?
    `).run(entryId, customerId);

    if (info.changes === 0) {
      return res.status(404).json({ error: 'Ledger entry not found' });
    }

    res.json({ success: true, outstanding: getOutstanding(customerId) });
  } catch (err) {
    console.error('Error deleting ledger entry:', err);
    res.status(500).json({ error: 'Failed to delete ledger entry' });
  }
});

// ---------------------------------------------------------------
// PUT /:id/opening-balance – set the carry-forward amount
// body: { opening_balance, opening_balance_date }
// ---------------------------------------------------------------
router.put('/:id/opening-balance', (req, res) => {
  try {
    const customerId = parseInt(req.params.id, 10);
    if (!customerId) {
      return res.status(400).json({ error: 'Invalid customer id' });
    }

    const customer = db.prepare('SELECT id FROM customers WHERE id = ?').get(customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const amount = parseAmount(req.body.opening_balance);
    const date = toDateOnly(req.body.opening_balance_date) || todayLocal();

    db.prepare(`
      UPDATE customers
      SET opening_balance = ?, opening_balance_date = ?
      WHERE id = ?
    `).run(amount, date, customerId);

    const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    res.json({ customer: updated, outstanding: getOutstanding(customerId) });
  } catch (err) {
    console.error('Error updating opening balance:', err);
    res.status(500).json({ error: 'Failed to update opening balance' });
  }
});

module.exports = router;
