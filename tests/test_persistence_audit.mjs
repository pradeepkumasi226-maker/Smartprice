/**
 * SmartPrice Project-Wide Persistence & Data-Flow Audit Regression Test Suite
 *
 * Verifies full end-to-end data flow:
 * UI API service payload -> FastAPI route -> SQLite write -> GET/reload confirmation.
 * Tests Dynamic Pricing ON/OFF, Product Edits, Inventory Restock,
 * What-If Scenarios (create/list/delete), Pricing Approvals, Guardrails, and error handling.
 */

const API_BASE = 'http://localhost:8000/api';

let totalTests = 0;
let passedTests = 0;

function assert(condition, testName, detail = '') {
  totalTests++;
  if (condition) {
    console.log(`[PASS] [${String(totalTests).padStart(2, '0')}]: ${testName}`);
    if (detail) console.log(`       -> ${detail}`);
    passedTests++;
  } else {
    console.error(`[FAIL] [${String(totalTests).padStart(2, '0')}]: ${testName}`);
    if (detail) console.error(`       -> ${detail}`);
  }
}

async function runAudit() {
  console.log('\n==================================================================');
  console.log('SMARTPRICE FULL PROJECT-WIDE PERSISTENCE AUDIT & REGRESSION SUITE');
  console.log('==================================================================\n');

  // 1. Health check & Authentication
  const healthRes = await fetch('http://localhost:8000/');
  const healthData = await healthRes.json();
  assert(healthRes.status === 200 && healthData.status === 'online', 'FastAPI backend is live and healthy');

  let authHeaders = { 'Content-Type': 'application/json' };
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'pradeep.retail@smartprice.ai', password: 'SmartPrice@2026!' })
  });
  if (loginRes.ok) {
    const loginData = await loginRes.json();
    const token = loginData?.session?.token;
    if (token) {
      authHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  // --- Dynamic Pricing Toggle Flow ---
  console.log('\n--- 1. Dynamic Pricing Toggle Persistence Flow (APP-1029) ---');

  // 1.1 Read initial
  const p1Res = await fetch(`${API_BASE}/products/APP-1029`);
  const p1 = await p1Res.json();
  const initialDynamic = Boolean(p1.dynamic_pricing);

  // 1.2 Enable Dynamic Pricing
  const enableRes = await fetch(`${API_BASE}/products/APP-1029`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ dynamic_pricing: true })
  });
  const enableData = await enableRes.json();
  assert(enableRes.status === 200 && enableData.dynamic_pricing === true, 'PUT /api/products/APP-1029 enables Dynamic Pricing (returns dynamic_pricing: true)');

  // 1.3 Fetch fresh GET to verify persistence
  const verifyEnableRes = await fetch(`${API_BASE}/products/APP-1029`);
  const verifyEnableData = await verifyEnableRes.json();
  assert(verifyEnableData.dynamic_pricing === true, 'GET /api/products/APP-1029 confirms Dynamic Pricing ON persists after reload', `dynamic_pricing: ${verifyEnableData.dynamic_pricing}`);

  // 1.4 Disable Dynamic Pricing
  const disableRes = await fetch(`${API_BASE}/products/APP-1029`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ dynamic_pricing: false })
  });
  const disableData = await disableRes.json();
  assert(disableRes.status === 200 && disableData.dynamic_pricing === false, 'PUT /api/products/APP-1029 disables Dynamic Pricing (returns dynamic_pricing: false)');

  // 1.5 Fetch fresh GET to verify persistence
  const verifyDisableRes = await fetch(`${API_BASE}/products/APP-1029`);
  const verifyDisableData = await verifyDisableRes.json();
  assert(verifyDisableData.dynamic_pricing === false, 'GET /api/products/APP-1029 confirms Dynamic Pricing OFF persists after reload', `dynamic_pricing: ${verifyDisableData.dynamic_pricing}`);

  // Restore initial state if it was true
  if (initialDynamic) {
    await fetch(`${API_BASE}/products/APP-1029`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ dynamic_pricing: true })
    });
  }

  // --- Product Edit Persistence Flow ---
  console.log('\n--- 2. Product Edit Persistence Flow (APP-3041) ---');
  const prodInitialRes = await fetch(`${API_BASE}/products/APP-3041`);
  const prodInitial = await prodInitialRes.json();
  const originalCompPrice = prodInitial.competitor_price;

  const testCompPrice = 74.99;
  const updateProdRes = await fetch(`${API_BASE}/products/APP-3041`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ competitor_price: testCompPrice })
  });
  const updateProdData = await updateProdRes.json();
  assert(updateProdRes.status === 200 && updateProdData.competitor_price === testCompPrice, `PUT /api/products/APP-3041 updates competitor_price to ${testCompPrice}`);

  // Verify reload
  const reloadProdRes = await fetch(`${API_BASE}/products/APP-3041`);
  const reloadProdData = await reloadProdRes.json();
  assert(reloadProdData.competitor_price === testCompPrice, `GET /api/products/APP-3041 confirms competitor_price ${testCompPrice} persists in SQLite`, `Persisted: ${reloadProdData.competitor_price}`);

  // Restore original competitor price
  await fetch(`${API_BASE}/products/APP-3041`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ competitor_price: originalCompPrice })
  });

  // --- Inventory Restock Persistence Flow ---
  console.log('\n--- 3. Inventory Restock Persistence Flow (HOM-7193) ---');
  const vacBeforeRes = await fetch(`${API_BASE}/products/HOM-7193`);
  const vacBefore = await vacBeforeRes.json();
  const vacInitialStock = vacBefore.stock_quantity;
  const restockQty = 15;
  let createdAuditTxId = null;

  try {
    const restockRes = await fetch(`${API_BASE}/inventory/HOM-7193/restock`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ quantity: restockQty, user: 'Persistence Audit Runner' })
    });
    assert(restockRes.status === 200, `POST /api/inventory/HOM-7193/restock with quantity +${restockQty} returns HTTP 200`);
    if (restockRes.status === 200) {
      const restockData = await restockRes.json();
      if (restockData?.transaction?.id) {
        createdAuditTxId = restockData.transaction.id;
      }
    }

    // Verify stock persisted in product table
    const vacAfterRes = await fetch(`${API_BASE}/products/HOM-7193`);
    const vacAfter = await vacAfterRes.json();
    assert(
      vacAfter.stock_quantity === vacInitialStock + restockQty,
      `Product stock quantity increased from ${vacInitialStock} to ${vacInitialStock + restockQty} in SQLite`,
      `Current Stock: ${vacAfter.stock_quantity}`
    );

    // Verify transaction record was created in inventory log
    const invLogRes = await fetch(`${API_BASE}/inventory`);
    const invLog = await invLogRes.json();
    const recentTx = invLog.logs?.find(t => (createdAuditTxId && t.id === createdAuditTxId) || (t.sku === 'HOM-7193' && t.quantity === restockQty));
    assert(recentTx !== undefined, 'Inventory ledger committed transaction record to database', `Tx ID: ${recentTx?.id}`);
    if (!createdAuditTxId && recentTx?.id) {
      createdAuditTxId = recentTx.id;
    }
  } finally {
    // Restore initial stock for idempotency via product update
    if (vacInitialStock !== undefined) {
      await fetch(`${API_BASE}/products/HOM-7193`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ stock_quantity: vacInitialStock })
      });
    }

    // Clean up only the specific transaction created by this audit test
    if (createdAuditTxId) {
      await fetch(`${API_BASE}/inventory/transactions/${encodeURIComponent(createdAuditTxId)}`, {
        method: 'DELETE',
        headers: authHeaders
      });
    }
  }

  // --- What-If Scenario Persistence Flow ---
  console.log('\n--- 4. What-If Scenario CRUD Persistence Flow ---');
  const testScenario = {
    product_id: 'prod-001',
    sku: 'ELC-4921',
    name: 'Audit High Elasticity Simulation',
    current_price: 219.50,
    simulated_price: 235.00,
    expected_demand: 265,
    expected_revenue: 62275.0,
    expected_margin: '59.6%',
    expected_gross_profit: 37100.0,
    status: 'Staged Draft'
  };

  const createScenRes = await fetch(`${API_BASE}/what-if/scenarios`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(testScenario)
  });
  const createScenData = await createScenRes.json();
  assert(createScenRes.status === 201 && createScenData.id, 'POST /api/what-if/scenarios creates and persists new scenario', `ID: ${createScenData.id}`);

  const scenarioId = createScenData.id;

  // Verify scenario is returned in scenarios list
  const listScenRes = await fetch(`${API_BASE}/what-if/scenarios`);
  const listScenData = await listScenRes.json();
  const foundScen = listScenData.find(s => s.id === scenarioId);
  assert(foundScen !== undefined && foundScen.simulated_price === 235.00, 'GET /api/what-if/scenarios returns persisted scenario after reload', `Found: ${foundScen?.name} ($${foundScen?.simulated_price})`);

  // Delete scenario and verify persistence of deletion
  const delScenRes = await fetch(`${API_BASE}/what-if/scenarios/${scenarioId}`, {
    method: 'DELETE',
    headers: authHeaders
  });
  assert(delScenRes.status === 200, `DELETE /api/what-if/scenarios/${scenarioId} succeeds with HTTP 200`);

  const listScenAfterDelRes = await fetch(`${API_BASE}/what-if/scenarios`);
  const listScenAfterDelData = await listScenAfterDelRes.json();
  const stillFound = listScenAfterDelData.find(s => s.id === scenarioId);
  assert(stillFound === undefined, 'GET /api/what-if/scenarios confirms scenario deletion persisted (row removed from SQLite)', `Found count for ID: 0`);

  // --- Pricing Decision Approval Flow & Guardrail Protection ---
  console.log('\n--- 5. Pricing Decision Approval & Margin Guardrail Enforcement ---');

  // Rejection of invalid price (below cost price)
  const invalidApproveRes = await fetch(`${API_BASE}/pricing/ELC-4921/approve`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ approved_price: 49.99, user: 'Audit Tester' })
  });
  const invalidApproveData = await invalidApproveRes.json();
  assert(
    invalidApproveRes.status === 400 && invalidApproveData.detail?.includes('violates margin guardrail'),
    'POST /api/pricing/ELC-4921/approve rejects below-cost price (₹49.99 < cost ₹95.00) with HTTP 400',
    `Error detail: ${invalidApproveData.detail}`
  );

  // Verify price did NOT change in database (false success prevention)
  const headphoneCheckRes = await fetch(`${API_BASE}/products/ELC-4921`);
  const headphoneCheck = await headphoneCheckRes.json();
  assert(headphoneCheck.current_price === 219.50, 'ELC-4921 shelf price remains ₹219.50 (not corrupted by rejected approval)', `Price: ₹${headphoneCheck.current_price}`);

  // Valid price approval
  const validApproveRes = await fetch(`${API_BASE}/pricing/ELC-4921/approve`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ approved_price: 219.50, user: 'Audit Retail Lead' })
  });
  assert(validApproveRes.status === 200, 'POST /api/pricing/ELC-4921/approve succeeds for valid price ₹219.50');

  // Verify recommendation status reflects Approval
  const recsRes = await fetch(`${API_BASE}/pricing/recommendations`);
  const recs = await recsRes.json();
  const headphoneRec = recs.find(r => r.sku === 'ELC-4921');
  assert(
    headphoneRec && headphoneRec.status === 'Approved' && headphoneRec.current_price === 219.50,
    'Pricing recommendations endpoint reflects persisted Approved status and current price',
    `Status: ${headphoneRec?.status}, Shelf: ₹${headphoneRec?.current_price}`
  );

  console.log('\n==================================================================');
  console.log(`AUDIT SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log('==================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Audit run encountered fatal error:', err);
  process.exit(1);
});
