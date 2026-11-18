const express = require('express');
const router = express.Router();
const { db } = require('../db');

// GET all permanent customers (with optional search query)
router.get('/', (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM customers';
    const params = [];

    if (search && search.trim()) {
      query += ` WHERE name LIKE ? OR shop_name LIKE ? OR phone LIKE ?`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY name ASC';
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
      INSERT INTO customers (name, shop_name, phone, address)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(
      name.trim(),
      (shop_name || '').trim(),
      (phone || '').trim(),
      (address || '').trim()
    );

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(customer);
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

    const stmt = db.prepare(`
      UPDATE customers
      SET name = ?, shop_name = ?, phone = ?, address = ?
      WHERE id = ?
    `);

    stmt.run(
      (name || '').trim(),
      (shop_name || '').trim(),
      (phone || '').trim(),
      (address || '').trim(),
      id
    );

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    res.json(customer);
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

module.exports = router;
