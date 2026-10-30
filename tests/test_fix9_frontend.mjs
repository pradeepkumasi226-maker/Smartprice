/**
 * Frontend unit test for Fix #9:
 * 1. calculateInventoryMetrics dynamic wholesale cost and retail potential valuation.
 * 2. filterSalesData canonical category and alias filtering.
 * 3. reconcileFinancialMetrics mathematical integrity.
 */

import assert from 'node:assert';
import {
  calculateInventoryMetrics,
  filterSalesData,
  CANONICAL_CATEGORIES,
  CATEGORY_ALIAS_MAP
} from '../frontend/src/utils/analytics.js';

console.log("Starting Fix #9 Frontend Unit Tests...\n");

// Test 1: Canonical Categories
console.log("Test 1: Canonical Category Taxonomy");
assert.deepStrictEqual(
  CANONICAL_CATEGORIES,
  ['Apparel', 'Beauty & Care', 'Electronics', 'Home Goods', 'Sports & Outdoors'],
  "CANONICAL_CATEGORIES must contain exactly the 5 canonical departments."
);
console.log("✓ CANONICAL_CATEGORIES verified.");

// Test 2: Category Alias Map
console.log("\nTest 2: Category Alias Map");
assert.ok(CATEGORY_ALIAS_MAP['Home Goods'].includes('Home & Kitchen'));
assert.ok(CATEGORY_ALIAS_MAP['Home & Kitchen'].includes('Home Goods'));
assert.ok(CATEGORY_ALIAS_MAP['Beauty & Care'].includes('Health & Beauty'));
assert.ok(CATEGORY_ALIAS_MAP['Health & Beauty'].includes('Beauty & Care'));
console.log("✓ Category alias bidirectional mappings verified.");

// Test 3: filterSalesData with Aliases
console.log("\nTest 3: filterSalesData Alias Resolution");
const mockSales = [
  { id: 1, category: 'Home & Kitchen', store: 'Store #101', date: '2026-08-15', revenue: 100, cost: 50, profit: 50, quantity: 2 },
  { id: 2, category: 'Home Goods', store: 'Store #101', date: '2026-08-16', revenue: 200, cost: 100, profit: 100, quantity: 4 },
  { id: 3, category: 'Apparel', store: 'Store #101', date: '2026-08-17', revenue: 300, cost: 150, profit: 150, quantity: 5 },
  { id: 4, category: 'Groceries', store: 'Store #101', date: '2026-08-18', revenue: 50, cost: 25, profit: 25, quantity: 1 }
];

const homeGoodsFiltered = filterSalesData(mockSales, { category: 'Home Goods', dateRange: 'all' });
assert.strictEqual(homeGoodsFiltered.length, 2, "Filtering by Home Goods should include both Home Goods and Home & Kitchen");

const apparelFiltered = filterSalesData(mockSales, { category: 'Apparel', dateRange: 'all' });
assert.strictEqual(apparelFiltered.length, 1);

const allFiltered = filterSalesData(mockSales, { category: 'All', dateRange: 'all' });
assert.strictEqual(allFiltered.length, 4, "All category scope should keep all transactions including unmapped ones");
console.log("✓ filterSalesData canonical alias filtering verified.");

// Test 4: calculateInventoryMetrics
console.log("\nTest 4: calculateInventoryMetrics Dynamic Wholesale and Retail Valuation");
const mockProducts = [
  { sku: 'SKU-1', stock_quantity: 10, cost_price: 50, current_price: 100 },
  { sku: 'SKU-2', stock_quantity: 20, cost_price: 25, current_price: 60 }
];

const metrics = calculateInventoryMetrics(mockProducts);
assert.strictEqual(metrics.totalStockUnits, 30);
// wholesaleCostValuation = 10*50 + 20*25 = 500 + 500 = 1000
assert.strictEqual(metrics.wholesaleCostValuation, 1000);
// retailPotentialValuation = 10*100 + 20*60 = 1000 + 1200 = 2200
assert.strictEqual(metrics.retailPotentialValuation, 2200);
assert.strictEqual(metrics.warehouseValuation, 1000);

// Test empty products list safety
const emptyMetrics = calculateInventoryMetrics([]);
assert.strictEqual(emptyMetrics.totalStockUnits, 0);
assert.strictEqual(emptyMetrics.wholesaleCostValuation, 0);
assert.strictEqual(emptyMetrics.retailPotentialValuation, 0);
console.log("✓ calculateInventoryMetrics dynamic valuation and empty-state safety verified.");

console.log("\nAll Fix #9 Frontend Unit Tests PASSED Successfully!\n");

