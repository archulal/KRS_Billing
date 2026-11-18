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
    console.log('✓ [Health Check]', health.data.status, 'Database:', health.data.database);
    if (health.status !== 200) throw new Error('Health check failed');

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

    console.log('\n========================================');
    console.log('🎉 ALL BACKEND & POS LOGIC TESTS PASSED!');
    console.log('========================================\n');

  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
