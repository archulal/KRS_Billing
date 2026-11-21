const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

// Tests always run against an isolated, disposable database so they never
// touch the real shop data. Test mode intentionally seeds demo customers.
const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'krs-test-'));
process.env.KRS_DATA_DIR = TEST_DATA_DIR;
process.env.KRS_ENV = 'test';

const { startServer } = require('./index');
const http = require('http');

async function runTests() {
  console.log('--- STARTING KRS BANANA BILLING SYSTEM VERIFICATION ---');
  const PORT = 5566;
  const { server } = await startServer(PORT);
  const baseUrl = `http://127.0.0.1:${PORT}`;

  function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(baseUrl + path);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: method,
        headers: { 'Content-Type': 'application/json' },
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, data });
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  try {
    // 1. Health check
    const health = await request('GET', '/api/health');
    console.log(
      '✓ [Health Check]',
      health.data.status,
      'Environment:',
      health.data.environment,
      'Database:',
      health.data.database
    );
    if (health.status !== 200) throw new Error('Health check failed');
    if (health.data.environment !== 'test') throw new Error('Test environment not active');

    // 2. Banana varieties check (Checking Ethan / ഏത്തൻ)
    const varieties = await request('GET', '/api/banana-types');
    console.log(`✓ [Banana Varieties] Found ${varieties.data.length} varieties.`);
    const ethan = varieties.data.find((v) => v.name_en === 'Ethan' || v.name_ml === 'ഏത്തൻ');
    if (!ethan || ethan.name_ml !== 'ഏത്തൻ') {
      throw new Error('Ethan / ഏത്തൻ not found in varieties');
    }
    console.log(`  - Ethan: ${ethan.name_en} / ${ethan.name_ml}, Rate: ₹${ethan.default_rate_per_kg}/kg, Waste: ${ethan.default_stem_waste_per_bunch_kg} kg/bunch`);

    // 3. Permanent customers check
    const customers = await request('GET', '/api/customers');
    console.log(`✓ [Permanent Customers] Found ${customers.data.length} pre-seeded customers.`);
    if (customers.data.length < 2) throw new Error('Permanent customers not seeded');

    // 4. Temporary walk-in staging check
    const walkins = await request('GET', '/api/customers/walkin');
    console.log(`✓ [Walk-In Staging] Found ${walkins.data.length} pre-seeded walk-in customers.`);
    const frequentBuyer = walkins.data.find((w) => w.visit_count >= 3);
    if (frequentBuyer) {
      console.log(`  - Frequent Buyer identified: ${frequentBuyer.name} (${frequentBuyer.phone}) with ${frequentBuyer.visit_count} visits and ₹${frequentBuyer.total_spent} spent.`);
    }

    // 5. Create a Bill with Exact Stem Waste Calculation
    console.log('✓ [Billing Test] Creating a new bill with Ethan & exact stem waste calculations...');
    // Line 1: Ethan (10 bunches, 150 kg gross, 0.5 kg/bunch waste, rate ₹48)
    // Stem Waste = 10 * 0.5 = 5.0 kg
    // Net Wt = 150 - 5 = 145.0 kg
    // Subtotal = 145 * 48 = 6960.00
    // Line 2: Robusta with custom rate & custom stem waste
    // Robusta (5 bunches, 80 kg gross, custom 0.60 kg/bunch waste, custom rate ₹35)
    // Stem Waste = 5 * 0.6 = 3.0 kg
    // Net Wt = 80 - 3 = 77.0 kg
    // Subtotal = 77 * 35 = 2695.00
    // Grand Total = 6960 + 2695 = 9655.00
    const testPhone = '9998887776';
    const newBillPayload = {
      customer_type: 'walkin',
      walkin_phone: testPhone,
      walkin_name: 'Gopan Nair',
      walkin_shop: 'Gopan Bakery & Sweets',
      items: [
        {
          banana_type_id: ethan.id,
          bunch_quantity: 10,
          gross_weight_kg: 150.0,
          waste_per_bunch_kg: 0.50,
          rate_per_kg: 48.0,
        },
        {
          banana_type_id: varieties.data.find((v) => v.name_en === 'Robusta').id,
          bunch_quantity: 5,
          gross_weight_kg: 80.0,
          waste_per_bunch_kg: 0.60,
          rate_per_kg: 35.0,
        },
      ],
    };

    const billRes = await request('POST', '/api/bills', newBillPayload);
    if (billRes.status !== 201) throw new Error('Bill creation failed: ' + JSON.stringify(billRes.data));
    const createdBill = billRes.data;
    console.log(`✓ [Bill Created] Bill No: ${createdBill.bill_number}, Customer: ${createdBill.customer_display_name}`);
    console.log(`  - Total Gross Wt: ${createdBill.total_gross_weight} kg (Expected: 230.00 kg)`);
    console.log(`  - Total Waste Wt: ${createdBill.total_waste_weight} kg (Expected: 8.00 kg)`);
    console.log(`  - Total Net Wt:   ${createdBill.total_net_weight} kg (Expected: 222.00 kg)`);
    console.log(`  - Grand Total:    ₹${createdBill.grand_total} (Expected: ₹9655.00)`);

    if (createdBill.total_waste_weight !== 8.0 || createdBill.total_net_weight !== 222.0 || createdBill.grand_total !== 9655.0) {
      throw new Error('Stem-waste or Grand Total calculation mismatch!');
    }

    // 5b. Customer ledger: opening balance + bill debit + payments
    console.log('✓ [Ledger Test] Verifying opening balance, bill debit, payment credit and running balance...');
    const ledgerToday = (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();
    const permCustomer = customers.data[0];
    const ledgerBillRes = await request('POST', '/api/bills', {
      customer_type: 'permanent',
      customer_id: permCustomer.id,
      items: [
        {
          banana_type_id: ethan.id,
          bunch_quantity: 10,
          gross_weight_kg: 100,
          waste_per_bunch_kg: 0.5,
          rate_per_kg: 40,
        },
      ],
    });
    if (ledgerBillRes.status !== 201) {
      throw new Error('Ledger test bill creation failed: ' + JSON.stringify(ledgerBillRes.data));
    }
    const ledgerBill = ledgerBillRes.data;
    // 10 * 0.5 = 5 kg waste, 95 kg net, 95 * 40 = ₹3800
    if (ledgerBill.grand_total !== 3800) {
      throw new Error(`Ledger test bill total mismatch: ${ledgerBill.grand_total}`);
    }

    let ledger = await request('GET', `/api/customers/${permCustomer.id}/ledger`);
    if (ledger.status !== 200) throw new Error('Ledger fetch failed');
    if (ledger.data.lifetime.outstanding !== 3800) {
      throw new Error(`Expected outstanding 3800, got ${ledger.data.lifetime.outstanding}`);
    }
    if (ledger.data.entries.length !== 2) {
      throw new Error(`Expected opening + bill rows, got ${ledger.data.entries.length}`);
    }

    const openingRes = await request('PUT', `/api/customers/${permCustomer.id}/opening-balance`, {
      opening_balance: 1000,
      opening_balance_date: '2000-01-01',
    });
    if (openingRes.status !== 200 || openingRes.data.outstanding !== 4800) {
      throw new Error(`Opening balance update failed: ${JSON.stringify(openingRes.data)}`);
    }

    const paymentRes = await request('POST', `/api/customers/${permCustomer.id}/ledger/entries`, {
      entry_type: 'payment',
      direction: 'credit',
      amount: 800,
      entry_date: ledgerToday,
      note: 'Cash payment',
    });
    if (paymentRes.status !== 201 || paymentRes.data.outstanding !== 4000) {
      throw new Error(`Payment entry failed: ${JSON.stringify(paymentRes.data)}`);
    }
    const paymentId = paymentRes.data.entry.id;

    ledger = await request('GET', `/api/customers/${permCustomer.id}/ledger`);
    if (ledger.data.summary.closing_balance !== 4000) {
      throw new Error(`Expected closing balance 4000, got ${ledger.data.summary.closing_balance}`);
    }
    const paymentRow = ledger.data.entries.find((row) => row.kind === 'payment');
    if (!paymentRow || paymentRow.credit !== 800 || paymentRow.balance !== 4000) {
      throw new Error('Payment row / running balance incorrect');
    }

    // Date filter must carry forward the balance before the period.
    const filtered = await request('GET', `/api/customers/${permCustomer.id}/ledger?from=${ledgerToday}&to=${ledgerToday}`);
    if (filtered.data.carried_forward !== 1000 || filtered.data.summary.closing_balance !== 4000) {
      throw new Error(`Date-filtered carry-forward incorrect: ${JSON.stringify(filtered.data.summary)}`);
    }

    const customerList = await request('GET', '/api/customers');
    const listed = customerList.data.find((c) => c.id === permCustomer.id);
    if (!listed || listed.outstanding !== 4000) {
      throw new Error(`Customer outstanding column incorrect: ${listed && listed.outstanding}`);
    }

    const deletePayment = await request('DELETE', `/api/customers/${permCustomer.id}/ledger/entries/${paymentId}`);
    if (deletePayment.status !== 200 || deletePayment.data.outstanding !== 4800) {
      throw new Error('Deleting a ledger entry failed');
    }

    // Cancelled bills must not count towards the ledger.
    await request('PATCH', `/api/bills/${ledgerBill.id}/cancel`);
    ledger = await request('GET', `/api/customers/${permCustomer.id}/ledger`);
    if (ledger.data.lifetime.outstanding !== 1000) {
      throw new Error(`Cancelled bill still counted: ${ledger.data.lifetime.outstanding}`);
    }
    console.log('  - Opening ₹1000, bill ₹3800, payment ₹800, cancellation and date filter all correct.');

    // 5c. POS amount paid: partial payment must reduce dues and appear in ledger
    const paidBillRes = await request('POST', '/api/bills', {
      customer_type: 'permanent',
      customer_id: permCustomer.id,
      amount_paid: 2000,
      items: [
        {
          banana_type_id: ethan.id,
          bunch_quantity: 10,
          gross_weight_kg: 100,
          waste_per_bunch_kg: 0.5,
          rate_per_kg: 40,
        },
      ],
    });
    if (paidBillRes.status !== 201) {
      throw new Error('POS paid bill creation failed: ' + JSON.stringify(paidBillRes.data));
    }
    if (paidBillRes.data.amount_paid !== 2000 || paidBillRes.data.balance_due !== 1800) {
      throw new Error(`POS amount paid not stored correctly: ${JSON.stringify(paidBillRes.data)}`);
    }
    if (paidBillRes.data.previous_balance !== 1000) {
      throw new Error(`Previous debit balance not stored on bill: ${JSON.stringify(paidBillRes.data)}`);
    }
    if (paidBillRes.data.customer_outstanding_before !== 1000 || paidBillRes.data.customer_outstanding_after !== 2800) {
      throw new Error(`Outstanding balances missing from bill response: ${JSON.stringify(paidBillRes.data)}`);
    }

    ledger = await request('GET', `/api/customers/${permCustomer.id}/ledger`);
    const billPaymentRow = ledger.data.entries.find((row) => row.kind === 'bill_payment');
    if (!billPaymentRow || billPaymentRow.credit !== 2000) {
      throw new Error('POS bill payment row missing from ledger');
    }
    if (ledger.data.lifetime.outstanding !== 2800 || ledger.data.lifetime.total_paid !== 2000) {
      throw new Error(`POS payment not reflected in ledger totals: ${JSON.stringify(ledger.data.lifetime)}`);
    }

    const customerListAfterPaid = await request('GET', '/api/customers');
    const listedAfterPaid = customerListAfterPaid.data.find((c) => c.id === permCustomer.id);
    if (listedAfterPaid.outstanding !== 2800) {
      throw new Error(`Outstanding after POS payment incorrect: ${listedAfterPaid.outstanding}`);
    }

    // Overpayment is clamped to the bill total.
    const overpaidRes = await request('POST', '/api/bills', {
      customer_type: 'permanent',
      customer_id: permCustomer.id,
      amount_paid: 999999,
      items: [
        {
          banana_type_id: ethan.id,
          bunch_quantity: 1,
          gross_weight_kg: 10,
          waste_per_bunch_kg: 0,
          rate_per_kg: 10,
        },
      ],
    });
    if (overpaidRes.data.amount_paid !== 100 || overpaidRes.data.balance_due !== 0) {
      throw new Error(`Overpayment was not clamped: ${JSON.stringify(overpaidRes.data)}`);
    }
    if (overpaidRes.data.old_dues_paid !== 2800) {
      throw new Error(`Extra payment was not applied to old dues: ${JSON.stringify(overpaidRes.data)}`);
    }
    if (overpaidRes.data.customer_outstanding_after !== 0) {
      throw new Error(`Balance after paying old dues incorrect: ${overpaidRes.data.customer_outstanding_after}`);
    }

    const finalLedger = await request('GET', `/api/customers/${permCustomer.id}/ledger`);
    if (finalLedger.data.lifetime.outstanding !== 0) {
      throw new Error(`Final ledger outstanding not cleared: ${finalLedger.data.lifetime.outstanding}`);
    }
    const oldDuesEntry = finalLedger.data.entries.find(
      (row) => row.kind === 'payment' && row.credit === 2800
    );
    if (!oldDuesEntry) {
      throw new Error('Old-dues payment missing from ledger');
    }
    console.log('  - POS paid ₹2000/₹3800, ledger credit row, balance due and overpayment clamp all correct.');
    console.log('  - Extra ₹2800 adjusts old dues, appears in ledger and clears balance to zero.');

    // 5d. Saved customer with an advance: applying it reduces the cash collected.
    const advanceCustomer = customers.data[1];
    await request('PUT', `/api/customers/${advanceCustomer.id}/opening-balance`, {
      opening_balance: -500,
      opening_balance_date: ledgerToday
    });

    const advanceBillRes = await request('POST', '/api/bills', {
      customer_type: 'permanent',
      customer_id: advanceCustomer.id,
      amount_paid: 500,
      advance_adjusted: 500,
      advance_balance: 500,
      items: [
        {
          banana_type_id: ethan.id,
          bunch_quantity: 1,
          gross_weight_kg: 100,
          waste_per_bunch_kg: 0,
          rate_per_kg: 10,
        },
      ],
    });
    if (advanceBillRes.data.advance_adjusted !== 500 || advanceBillRes.data.balance_due !== 0) {
      throw new Error(`Advance adjustment not stored correctly: ${JSON.stringify(advanceBillRes.data)}`);
    }
    if (advanceBillRes.data.advance_balance !== 500) {
      throw new Error(`Customer advance balance not stored on bill: ${JSON.stringify(advanceBillRes.data)}`);
    }
    if (advanceBillRes.data.previous_balance !== -500) {
      throw new Error(`Credit/debit position not stored on bill: ${JSON.stringify(advanceBillRes.data)}`);
    }
    if (advanceBillRes.data.customer_outstanding_after !== 0) {
      throw new Error(`Advance adjustment not reflected in balance: ${advanceBillRes.data.customer_outstanding_after}`);
    }
    const advanceLedger = await request('GET', `/api/customers/${advanceCustomer.id}/ledger`);
    if (advanceLedger.data.lifetime.outstanding !== 0) {
      throw new Error(`Advance ledger balance incorrect: ${advanceLedger.data.lifetime.outstanding}`);
    }
    const advanceBillList = await request('GET', '/api/bills');
    const billInList = advanceBillList.data.find((b) => b.id === advanceBillRes.data.id);
    if (!billInList || billInList.balance_due !== 0) {
      throw new Error(`Advance-adjusted bill still shows dues in history: ${JSON.stringify(billInList)}`);
    }
    console.log('  - Advance ₹500 adjusted against bill, cash collected ₹500, no dues shown in history.');

    // 5e. Settings: UPI id and feature toggles
    const initialSettings = await request('GET', '/api/settings');
    if (
      initialSettings.data.upi_id !== 'Vyapar.178760240373@hdfcbank' ||
      initialSettings.data.whatsapp_enabled !== 'true' ||
      initialSettings.data.qr_enabled !== 'true'
    ) {
      throw new Error(`Unexpected default settings: ${JSON.stringify(initialSettings.data)}`);
    }

    const savedSettings = await request('PUT', '/api/settings', {
      upi_id: 'merchant.test@upi',
      whatsapp_enabled: false,
      qr_enabled: false,
    });
    if (
      savedSettings.data.upi_id !== 'merchant.test@upi' ||
      savedSettings.data.whatsapp_enabled !== 'false' ||
      savedSettings.data.qr_enabled !== 'false'
    ) {
      throw new Error(`Settings were not saved/typed correctly: ${JSON.stringify(savedSettings.data)}`);
    }
    await request('PUT', '/api/settings', {
      upi_id: 'Vyapar.178760240373@hdfcbank',
      whatsapp_enabled: true,
      qr_enabled: true,
    });
    console.log('  - UPI id, WhatsApp toggle and QR toggle saved as settings.');

    // 6. Production mode must NOT seed demo customers
    const prodDir = fs.mkdtempSync(path.join(os.tmpdir(), 'krs-prod-'));
    try {
      const dbModulePath = path.join(__dirname, 'db.js');
      const output = execFileSync(
        process.execPath,
        [
          '-e',
          `
            const { db } = require(${JSON.stringify(dbModulePath)});
            const customers = db.prepare('SELECT COUNT(*) AS count FROM customers').get().count;
            const walkins = db.prepare('SELECT COUNT(*) AS count FROM temp_walkin_customers').get().count;
            const varieties = db.prepare('SELECT COUNT(*) AS count FROM banana_types').get().count;
            console.log('RESULT:' + JSON.stringify({ customers, walkins, varieties }));
          `,
        ],
        {
          env: { ...process.env, KRS_DATA_DIR: prodDir, KRS_ENV: 'production' },
          encoding: 'utf8',
        }
      );

      const resultLine = output.split('\n').find((line) => line.startsWith('RESULT:'));
      const counts = JSON.parse(resultLine.slice('RESULT:'.length));

      if (counts.customers !== 0 || counts.walkins !== 0) {
        throw new Error('Production database was seeded with demo customers!');
      }
      if (counts.varieties === 0) {
        throw new Error('Production database is missing default banana varieties!');
      }
      console.log('✓ [Production Mode] No demo customers seeded; default varieties available.');
    } finally {
      fs.rmSync(prodDir, { recursive: true, force: true });
    }

    console.log('\n========================================');
    console.log('🎉 ALL BACKEND & POS LOGIC TESTS PASSED!');
    console.log('========================================\n');

  } finally {
    server.close();
    try {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    } catch (cleanupError) {
      console.warn('Could not remove temporary test database:', cleanupError.message);
    }
  }
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
