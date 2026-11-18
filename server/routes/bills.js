const express = require('express');
const router = express.Router();
const { db } = require('../db');

// Helper to generate next sequential bill number: KRS-YYYY-XXXX
function generateNextBillNumber() {
  const currentYear = new Date().getFullYear();
  const prefix = `KRS-${currentYear}-`;
  
  const lastBill = db.prepare(`
    SELECT bill_number FROM bills 
    WHERE bill_number LIKE ? 
    ORDER BY id DESC LIMIT 1
  `).get(`${prefix}%`);

  let nextSequence = 1;
  if (lastBill && lastBill.bill_number) {
    const parts = lastBill.bill_number.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      nextSequence = lastSeq + 1;
    }
  }

  return `${prefix}${String(nextSequence).padStart(4, '0')}`;
}

// GET all bills with search and pagination / limit
router.get('/', (req, res) => {
  try {
    const { search, date } = req.query;
    let query = `
      SELECT b.*, 
        COUNT(bi.id) as total_items,
        SUM(bi.bunch_quantity) as total_bunches
      FROM bills b
      LEFT JOIN bill_items bi ON b.id = bi.bill_id
    `;
    const params = [];
    const conditions = [];

    if (search && search.trim()) {
      conditions.push(`(b.bill_number LIKE ? OR b.customer_display_name LIKE ? OR b.customer_phone LIKE ?)`);
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    if (date) {
      conditions.push(`date(b.date) = date(?)`);
      params.push(date);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` GROUP BY b.id ORDER BY b.id DESC`;

    const bills = db.prepare(query).all(...params);
    res.json(bills);
  } catch (err) {
    console.error('Error fetching bills:', err);
    res.status(500).json({ error: 'Failed to fetch bills' });
  }
});

// GET summary stats (today's sales, bunch count, weight, total bills)
router.get('/stats/summary', (req, res) => {
  try {
    const todaySummary = db.prepare(`
      SELECT 
        COUNT(DISTINCT b.id) as today_bills_count,
        COALESCE(SUM(b.grand_total), 0) as today_sales,
        COALESCE(SUM(b.total_net_weight), 0) as today_net_weight,
        COALESCE(SUM(bi.bunch_quantity), 0) as today_bunches
      FROM bills b
      LEFT JOIN bill_items bi ON b.id = bi.bill_id
      WHERE date(b.date) = date('now', 'localtime')
    `).get();

    const allTimeSummary = db.prepare(`
      SELECT 
        COUNT(id) as total_bills_count,
        COALESCE(SUM(grand_total), 0) as total_sales,
        COALESCE(SUM(total_net_weight), 0) as total_net_weight
      FROM bills
    `).get();

    res.json({
      today: todaySummary,
      allTime: allTimeSummary
    });
  } catch (err) {
    console.error('Error fetching bill stats:', err);
    res.status(500).json({ error: 'Failed to fetch bill stats' });
  }
});

// GET single bill with full item details and banana variety names
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const bill = db.prepare(`
      SELECT b.*, 
        c.name as permanent_customer_name,
        c.shop_name as permanent_shop_name,
        c.address as permanent_address
      FROM bills b
      LEFT JOIN customers c ON b.customer_id = c.id
      WHERE b.id = ?
    `).get(id);

    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    const items = db.prepare(`
      SELECT bi.*, 
        bt.name_en, bt.name_ml, bt.default_rate_per_kg, bt.default_stem_waste_per_bunch_kg
      FROM bill_items bi
      JOIN banana_types bt ON bi.banana_type_id = bt.id
      WHERE bi.bill_id = ?
      ORDER BY bi.id ASC
    `).all(id);

    res.json({
      ...bill,
      items
    });
  } catch (err) {
    console.error('Error fetching single bill:', err);
    res.status(500).json({ error: 'Failed to fetch bill details' });
  }
});

// POST create new bill with transaction
router.post('/', (req, res) => {
  const {
    customer_type, // 'permanent' | 'walkin'
    customer_id,   // for permanent
    walkin_phone,  // optional walkin capture
    walkin_name,
    walkin_shop,
    items          // array of { banana_type_id, bunch_quantity, gross_weight_kg, waste_per_bunch_kg, rate_per_kg }
  } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Bill must contain at least one line item.' });
  }

  const createBillTransaction = db.transaction(() => {
    let finalCustomerId = null;
    let finalTempWalkinId = null;
    let customerDisplayName = 'Walk-In Customer / നടപ്പു കസ്റ്റമർ';
    let customerPhone = '';

    if (customer_type === 'permanent' && customer_id) {
      finalCustomerId = customer_id;
      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id);
      if (customer) {
        customerDisplayName = customer.shop_name 
          ? `${customer.shop_name} (${customer.name})`
          : customer.name;
        customerPhone = customer.phone || '';
      }
    } else {
      // Walk-in customer
      if (walkin_phone && walkin_phone.trim()) {
        const cleanPhone = walkin_phone.trim();
        const cleanName = (walkin_name || '').trim();
        const cleanShop = (walkin_shop || '').trim();

        // Check if existing
        const existingWalkin = db.prepare('SELECT * FROM temp_walkin_customers WHERE phone = ?').get(cleanPhone);
        if (existingWalkin) {
          finalTempWalkinId = existingWalkin.id;
          db.prepare(`
            UPDATE temp_walkin_customers
            SET visit_count = visit_count + 1,
                name = CASE WHEN ? != '' THEN ? ELSE name END,
                shop_name = CASE WHEN ? != '' THEN ? ELSE shop_name END,
                last_visit_date = datetime('now')
            WHERE id = ?
          `).run(cleanName, cleanName, cleanShop, cleanShop, existingWalkin.id);
        } else {
          const insertWalkin = db.prepare(`
            INSERT INTO temp_walkin_customers (phone, name, shop_name, visit_count, total_spent, first_visit_date, last_visit_date)
            VALUES (?, ?, ?, 1, 0, datetime('now'), datetime('now'))
          `).run(cleanPhone, cleanName, cleanShop);
          finalTempWalkinId = insertWalkin.lastInsertRowid;
        }

        customerPhone = cleanPhone;
        if (cleanShop && cleanName) {
          customerDisplayName = `${cleanShop} (${cleanName})`;
        } else if (cleanShop || cleanName) {
          customerDisplayName = cleanShop || cleanName;
        } else {
          customerDisplayName = `Walk-in (${cleanPhone})`;
        }
      } else if (walkin_name && walkin_name.trim()) {
        customerDisplayName = walkin_name.trim();
      }
    }

    // Calculate item and bill totals exactly per formula:
    // Total Waste Weight = Quantity (Bunches) × Waste per Bunch (kg)
    // Net Weight = Gross Weight - Total Waste Weight
    // Line Total = Net Weight × Editable Rate per Kg
    let totalGrossWeight = 0;
    let totalWasteWeight = 0;
    let totalNetWeight = 0;
    let grandTotal = 0;

    const processedItems = items.map((item) => {
      const bunchQty = parseInt(item.bunch_quantity, 10) || 0;
      const grossWt = parseFloat(item.gross_weight_kg) || 0;
      const wastePerBunch = parseFloat(item.waste_per_bunch_kg) || 0;
      const rate = parseFloat(item.rate_per_kg) || 0;

      const totalWaste = Math.round(bunchQty * wastePerBunch * 100) / 100;
      const netWt = Math.round(Math.max(0, grossWt - totalWaste) * 100) / 100;
      const subtotal = Math.round(netWt * rate * 100) / 100;

      totalGrossWeight += grossWt;
      totalWasteWeight += totalWaste;
      totalNetWeight += netWt;
      grandTotal += subtotal;

      return {
        banana_type_id: item.banana_type_id,
        bunch_quantity: bunchQty,
        gross_weight_kg: grossWt,
        waste_per_bunch_kg: wastePerBunch,
        total_waste_kg: totalWaste,
        net_weight_kg: netWt,
        rate_per_kg: rate,
        subtotal: subtotal
      };
    });

    totalGrossWeight = Math.round(totalGrossWeight * 100) / 100;
    totalWasteWeight = Math.round(totalWasteWeight * 100) / 100;
    totalNetWeight = Math.round(totalNetWeight * 100) / 100;
    // Wholesale rounding rule: round down to whole integer rupee (e.g. 200.40 -> 200, 200.80 -> 200)
    grandTotal = Math.floor(grandTotal);

    // Update walkin total_spent if temp_walkin_id exists
    if (finalTempWalkinId) {
      db.prepare(`
        UPDATE temp_walkin_customers
        SET total_spent = total_spent + ?
        WHERE id = ?
      `).run(grandTotal, finalTempWalkinId);
    }

    const billNumber = generateNextBillNumber();

    const insertBill = db.prepare(`
      INSERT INTO bills (
        bill_number, customer_type, customer_id, temp_walkin_id,
        customer_display_name, customer_phone, date,
        total_gross_weight, total_waste_weight, total_net_weight, grand_total
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), ?, ?, ?, ?)
    `);

    const billResult = insertBill.run(
      billNumber,
      customer_type || 'walkin',
      finalCustomerId,
      finalTempWalkinId,
      customerDisplayName,
      customerPhone,
      totalGrossWeight,
      totalWasteWeight,
      totalNetWeight,
      grandTotal
    );

    const billId = billResult.lastInsertRowid;

    const insertItem = db.prepare(`
      INSERT INTO bill_items (
        bill_id, banana_type_id, bunch_quantity, gross_weight_kg,
        waste_per_bunch_kg, total_waste_kg, net_weight_kg, rate_per_kg, subtotal
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of processedItems) {
      insertItem.run(
        billId,
        item.banana_type_id,
        item.bunch_quantity,
        item.gross_weight_kg,
        item.waste_per_bunch_kg,
        item.total_waste_kg,
        item.net_weight_kg,
        item.rate_per_kg,
        item.subtotal
      );
    }

    return billId;
  });

  try {
    const billId = createBillTransaction();
    
    // Return complete created bill
    const createdBill = db.prepare('SELECT * FROM bills WHERE id = ?').get(billId);
    const createdItems = db.prepare(`
      SELECT bi.*, bt.name_en, bt.name_ml
      FROM bill_items bi
      JOIN banana_types bt ON bi.banana_type_id = bt.id
      WHERE bi.bill_id = ?
      ORDER BY bi.id ASC
    `).all(billId);

    res.status(201).json({
      ...createdBill,
      items: createdItems
    });
  } catch (err) {
    console.error('Error creating bill:', err);
    res.status(500).json({ error: err.message || 'Failed to create bill' });
  }
});

module.exports = router;
