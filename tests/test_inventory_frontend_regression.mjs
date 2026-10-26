/**
 * SmartPrice Inventory Frontend Regression Test Suite
 * Tests normalization, evaluation, filtering, metrics, and ledger balance rendering logic.
 */

import { normalizeInventoryTransaction, normalizeProduct } from '../frontend/src/utils/productUtils.js';
import { evaluateStockStatus, calculateInventoryMetrics } from '../frontend/src/utils/analytics.js';
import { mockProducts } from '../frontend/src/data/mockProducts.js';

let passed = 0;
let total = 0;

function assert(condition, testName, details = '') {
  total++;
  if (condition) {
    console.log(`[PASS] [${String(total).padStart(2, '0')}]: ${testName}`);
    if (details) console.log(`       -> ${details}`);
    passed++;
  } else {
    console.error(`[FAIL] [${String(total).padStart(2, '0')}]: ${testName}`);
    if (details) console.error(`       -> ${details}`);
  }
}

console.log('\n==================================================');
console.log('SMARTPRICE INVENTORY FRONTEND REGRESSION TEST');
console.log('==================================================\n');

// 1. normalizeInventoryTransaction with backend response structure (new_stock and created_at)
const backendTx = {
  id: 'inv-tx-1792912587396',
  product_id: 'prod-007',
  sku: 'SPT-2019',
  product_name: 'Carbon Fiber Lightweight Tennis Racket',
  transaction_type: 'RESTOCK',
  quantity: 24,
  previous_stock: 16,
  new_stock: 40,
  unit_cost: 62.0,
  reference: 'PO-REC-2587',
  user: 'Retail Inventory Specialist',
  notes: 'Restock PO received from Apex Athletics Equipment',
  created_at: '2026-10-25T07:16:27.415853'
};

const normTx1 = normalizeInventoryTransaction(backendTx);
assert(normTx1.remaining_stock === 40, 'normalizeInventoryTransaction sets remaining_stock from new_stock', `remaining_stock: ${normTx1.remaining_stock}`);
assert(normTx1.remainingStock === 40, 'normalizeInventoryTransaction sets camelCase remainingStock');
assert(normTx1.new_stock === 40, 'normalizeInventoryTransaction preserves new_stock');
assert(normTx1.date === '2026-10-25 07:16', 'normalizeInventoryTransaction formats created_at to clean date string', `date: ${normTx1.date}`);

// 2. normalizeInventoryTransaction with legacy mock structure (remaining_stock and date)
const mockTx = {
  id: 'inv-tx-101',
  product_id: 'prod-006',
  sku: 'HOM-7193',
  date: '2026-08-19 11:20',
  transaction_type: 'SALE',
  quantity: -5,
  remaining_stock: 8,
  unit_cost: 195.00
};
const normTx2 = normalizeInventoryTransaction(mockTx);
assert(normTx2.remaining_stock === 8, 'normalizeInventoryTransaction preserves existing remaining_stock');
assert(normTx2.new_stock === 8, 'normalizeInventoryTransaction populates new_stock from remaining_stock');
assert(normTx2.date === '2026-08-19 11:20', 'normalizeInventoryTransaction preserves existing formatted date');

// 3. Ledger rendering verification: remaining balance column should NEVER render bare 'units'
function renderRemainingBalanceCell(tx) {
  const balance = tx.remaining_stock !== undefined ? tx.remaining_stock : (tx.new_stock !== undefined ? tx.new_stock : '—');
  return `${balance} units`;
}

assert(renderRemainingBalanceCell(normTx1) === '40 units', 'Remaining balance cell renders numeric balance "40 units"', renderRemainingBalanceCell(normTx1));
assert(renderRemainingBalanceCell(backendTx) === '40 units', 'Remaining balance cell gracefully falls back to new_stock if remaining_stock missing');
assert(renderRemainingBalanceCell(normTx2) === '8 units', 'Remaining balance cell renders numeric balance "8 units"');
assert(!renderRemainingBalanceCell(normTx1).startsWith(' units'), 'Remaining balance cell never displays bare " units" without a number');

// 4. evaluateStockStatus verification
assert(evaluateStockStatus(16, 20, 10) === 'Low Stock', 'evaluateStockStatus(16, 20, 10) returns "Low Stock"');
assert(evaluateStockStatus(40, 20, 10) === 'Optimal', 'evaluateStockStatus(40, 20, 10) returns "Optimal"');
assert(evaluateStockStatus(8, 20, 10) === 'Critical', 'evaluateStockStatus(8, 20, 10) returns "Critical"');
assert(evaluateStockStatus(0, 20, 10) === 'Critical', 'evaluateStockStatus(0, 20, 10) returns "Critical"');
assert(evaluateStockStatus(80, 20, 10) === 'Overstocked', 'evaluateStockStatus(80, 20, 10) returns "Overstocked"');

// 5. Status filter matching verification (as implemented in InventoryPage.jsx)
function matchesStatusFilter(p, selectedStatus) {
  return selectedStatus === 'All' ||
    p.status === selectedStatus ||
    (selectedStatus === 'In Stock' && (p.status === 'Optimal' || p.status === 'In Stock')) ||
    (selectedStatus === 'Optimal' && (p.status === 'Optimal' || p.status === 'In Stock'));
}

const sampleProducts = [
  { sku: 'SPT-2019', status: 'Optimal' },
  { sku: 'HOM-7193', status: 'Overstocked' },
  { sku: 'CRIT-001', status: 'Critical' },
  { sku: 'LOW-002', status: 'Low Stock' },
  { sku: 'IN-003', status: 'In Stock' }
];

const inStockFiltered = sampleProducts.filter(p => matchesStatusFilter(p, 'In Stock'));
assert(
  inStockFiltered.length === 2 && inStockFiltered.some(p => p.sku === 'SPT-2019') && inStockFiltered.some(p => p.sku === 'IN-003'),
  'Filter "In Stock" matches both "Optimal" (SPT-2019) and "In Stock"',
  `Matched SKUs: ${inStockFiltered.map(p => p.sku).join(', ')}`
);

const critFiltered = sampleProducts.filter(p => matchesStatusFilter(p, 'Critical'));
assert(critFiltered.length === 1 && critFiltered[0].sku === 'CRIT-001', 'Filter "Critical" matches exactly Critical product');

const lowFiltered = sampleProducts.filter(p => matchesStatusFilter(p, 'Low Stock'));
assert(lowFiltered.length === 1 && lowFiltered[0].sku === 'LOW-002', 'Filter "Low Stock" matches exactly Low Stock product');

const overFiltered = sampleProducts.filter(p => matchesStatusFilter(p, 'Overstocked'));
assert(overFiltered.length === 1 && overFiltered[0].sku === 'HOM-7193', 'Filter "Overstocked" matches exactly Overstocked product');

// 6. calculateInventoryMetrics verification
const testProducts = [
  { stock: 40, cost: 50, minimum_stock: 20, safetyStock: 10 }, // Optimal
  { stock: 15, cost: 20, minimum_stock: 20, safetyStock: 10 }, // Low Stock
  { stock: 5, cost: 100, minimum_stock: 20, safetyStock: 10 }, // Critical
  { stock: 90, cost: 10, minimum_stock: 20, safetyStock: 10 }  // Overstocked (90 > 20*3.5=70)
];

const metrics = calculateInventoryMetrics(testProducts);
assert(metrics.totalItems === 4, 'calculateInventoryMetrics totalItems === 4');
assert(metrics.totalStockUnits === 150, 'calculateInventoryMetrics totalStockUnits === 150 (40+15+5+90)');
assert(metrics.criticalItemsCount === 1, 'calculateInventoryMetrics criticalItemsCount === 1');
assert(metrics.lowStockItemsCount === 1, 'calculateInventoryMetrics lowStockItemsCount === 1');
assert(metrics.overstockedItemsCount === 1, 'calculateInventoryMetrics overstockedItemsCount === 1');

console.log('\n==================================================');
console.log(`FRONTEND REGRESSION SUMMARY: ${passed}/${total} TESTS PASSED`);
console.log('==================================================\n');

if (passed !== total) process.exit(1);
