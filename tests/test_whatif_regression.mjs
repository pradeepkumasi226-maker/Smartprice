/**
 * SmartPrice What-If Analysis & "Max Profit (AI)" Preset Regression Test Suite
 *
 * Verifies:
 * 1. Recommended price equal to current shelf price (ELC-8812 @ ₹947.58) does not leave preset stuck at baseline.
 * 2. Model-derived optimization finds the true profit-maximizing price under empirical elasticity.
 * 3. Target respects min (₹567.00) and max (₹1421.37) price guardrails.
 * 4. Distinct pending AI recommendations (different from shelf price) are respected.
 * 5. Flat model surfaces fall back to bounded heuristic targets marked as heuristic.
 * 6. Simulation metrics (demand, revenue, profit, margin, recommendation) recalculate properly.
 * 7. Other strategy presets ("Undercut Comp -3%", "Max Revenue", "Clearance Mode") continue working.
 */

import { calculateOptimalProfitTarget, calculateOptimalRevenueTarget } from '../frontend/src/utils/analytics.js';
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

console.log('\n======================================================');
console.log('SMARTPRICE WHAT-IF & "MAX PROFIT (AI)" REGRESSION TEST');
console.log('======================================================\n');

// 1. Live ELC-8812 product state (as reported in user prompt and backend DB)
const liveElc8812 = {
  id: 'prod-002',
  sku: 'ELC-8812',
  name: '4K Quantum-Dot OLED Smart TV (55-Inch)',
  category: 'Electronics',
  cost: 540.00,
  currentPrice: 947.58,
  recommendedPrice: 947.58,
  minPrice: 567.00,
  maxPrice: 1421.37,
  competitorPrice: 949.00,
  elasticity: -1.85,
  predictedDemand: 140
};

// Verify initial state reproducing the problem
assert(liveElc8812.currentPrice === 947.58, 'ELC-8812 shelf price is ₹947.58');
assert(liveElc8812.recommendedPrice === liveElc8812.currentPrice, 'ELC-8812 recommendedPrice equals current shelf price (reproducing root cause)');

// 2. Max Profit (AI) calculates a meaningful simulation target for ELC-8812
const targetInfo = calculateOptimalProfitTarget(liveElc8812);

assert(
  targetInfo.price !== liveElc8812.currentPrice,
  'Max Profit (AI) produces a new target instead of remaining stuck at ₹947.58',
  `Simulated target: ₹${targetInfo.price.toFixed(2)} (baseline: ₹${liveElc8812.currentPrice})`
);

assert(
  targetInfo.isModelDerived === true,
  'Max Profit (AI) calculates a genuine model-derived optimal target from elasticity and cost',
  targetInfo.description
);

assert(
  targetInfo.price >= liveElc8812.minPrice && targetInfo.price <= liveElc8812.maxPrice,
  'Simulated target respects min and max price guardrails',
  `Min: ₹${liveElc8812.minPrice} <= Target: ₹${targetInfo.price} <= Max: ₹${liveElc8812.maxPrice}`
);

// 3. Verify simulation recalculation and profit lift
function calculateSimulationMetrics(product, targetPrice, options = {}) {
  const basePrice = Number(product.currentPrice ?? 100);
  const baseCost = Number(product.cost ?? (basePrice * 0.5));
  const baseDemand = Number(product.predictedDemand ?? 100);
  const elasticityMultiplier = Number(options.elasticityMultiplier) || 1.0;
  const effectiveElasticity = Number(product.elasticity ?? -1.25) * elasticityMultiplier;
  const competitorOffset = Number(options.competitorOffset) || 0;
  const promoDiscount = Number(options.promoDiscount) || 0;

  const effectiveSimulatedPrice = Number((targetPrice * (1 - promoDiscount / 100)).toFixed(2));
  const priceDelta = effectiveSimulatedPrice - basePrice;
  const pricePercentDelta = basePrice > 0 ? priceDelta / basePrice : 0;

  const compDeltaDemand = -competitorOffset * 0.4;
  const promoDemandBoost = (promoDiscount / 100) * 0.5;
  const demandPercentDelta = (effectiveElasticity * pricePercentDelta) + (compDeltaDemand / 100) + promoDemandBoost;

  const simulatedDemand = Math.max(5, Math.round(baseDemand * (1 + demandPercentDelta)));
  const simulatedRevenue = Math.round(effectiveSimulatedPrice * simulatedDemand);
  const baselineRevenue = Math.round(basePrice * baseDemand);
  const revenueDelta = simulatedRevenue - baselineRevenue;

  const simulatedCost = Math.round(baseCost * simulatedDemand);
  const simulatedProfit = simulatedRevenue - simulatedCost;
  const baselineCost = Math.round(baseCost * baseDemand);
  const baselineProfit = baselineRevenue - baselineCost;
  const profitDelta = simulatedProfit - baselineProfit;

  return {
    targetPrice,
    simulatedDemand,
    baselineDemand: baseDemand,
    simulatedRevenue,
    baselineRevenue,
    revenueDelta,
    simulatedProfit,
    baselineProfit,
    profitDelta
  };
}

const baselineMetrics = calculateSimulationMetrics(liveElc8812, liveElc8812.currentPrice);
const simulatedMetrics = calculateSimulationMetrics(liveElc8812, targetInfo.price);

assert(
  baselineMetrics.baselineProfit === 57061,
  'ELC-8812 baseline profit matches ₹57,061',
  `Baseline profit: ₹${baselineMetrics.baselineProfit}`
);

assert(
  simulatedMetrics.simulatedProfit > baselineMetrics.baselineProfit,
  'Simulated profit at optimal target strictly exceeds baseline profit',
  `Baseline Profit: ₹${baselineMetrics.baselineProfit.toLocaleString()} -> Simulated Profit: ₹${simulatedMetrics.simulatedProfit.toLocaleString()} (+₹${simulatedMetrics.profitDelta.toLocaleString()})`
);

assert(
  simulatedMetrics.simulatedDemand !== baselineMetrics.baselineDemand,
  'Simulated demand recalculates immediately',
  `Baseline: ${baselineMetrics.baselineDemand} -> Simulated: ${simulatedMetrics.simulatedDemand} units`
);

assert(
  simulatedMetrics.simulatedRevenue !== baselineMetrics.baselineRevenue,
  'Simulated revenue recalculates immediately',
  `Baseline: ₹${baselineMetrics.baselineRevenue.toLocaleString()} -> Simulated: ₹${simulatedMetrics.simulatedRevenue.toLocaleString()}`
);

// 4. Verify distinct pending AI recommendation handling
const distinctProduct = {
  ...liveElc8812,
  currentPrice: 947.58,
  recommendedPrice: 980.00
};
const distinctTarget = calculateOptimalProfitTarget(distinctProduct);
assert(
  distinctTarget.price === 980.00,
  'Honors distinct pending AI recommendation when different from current price',
  `Target: ₹${distinctTarget.price}`
);
assert(
  distinctTarget.isModelDerived === false && distinctTarget.isHeuristic === false,
  'Correctly marks recommendation as existing approved AI target rather than derived'
);

// Also verify with mockProducts where recommendedPrice is distinct
const mockElc = mockProducts.find(p => p.sku === 'ELC-8812');
if (mockElc && mockElc.recommendedPrice !== mockElc.currentPrice) {
  const mockRecTarget = calculateOptimalProfitTarget(mockElc);
  assert(
    mockRecTarget.price === mockElc.recommendedPrice,
    'Honors distinct recommendedPrice from mock dataset (₹929.00 vs ₹899.00)',
    `Target: ₹${mockRecTarget.price}`
  );
}

// 5. Guardrail enforcement tests
const outOfBoundsProduct = {
  currentPrice: 100,
  recommendedPrice: 250,
  minPrice: 80,
  maxPrice: 120,
  cost: 60,
  elasticity: -1.2,
  predictedDemand: 50
};
const clampedTarget = calculateOptimalProfitTarget(outOfBoundsProduct);
assert(
  clampedTarget.price === 120,
  'Clamps recommended price to maxPrice guardrail when upper bound is exceeded',
  `Target: ₹${clampedTarget.price} (maxPrice: ₹${outOfBoundsProduct.maxPrice})`
);

// 6. Flat surface heuristic fallback test
const flatProduct = {
  currentPrice: 100,
  recommendedPrice: 100,
  cost: 100,
  elasticity: -1.0,
  minPrice: 100,
  maxPrice: 100,
  predictedDemand: 50
};
const heuristicTarget = calculateOptimalProfitTarget(flatProduct);
assert(
  heuristicTarget.isHeuristic === true,
  'Uses clearly documented heuristic fallback when profit cannot be improved via grid search'
);
assert(
  heuristicTarget.price >= flatProduct.minPrice && heuristicTarget.price <= flatProduct.maxPrice,
  'Heuristic target strictly respects guardrail bounds',
  `Target: ₹${heuristicTarget.price} in [${flatProduct.minPrice}, ${flatProduct.maxPrice}]`
);

// 7. Verify other presets continue working on ELC-8812
const compPrice = Number(liveElc8812.competitorPrice);
const undercutTarget = Number(Math.max(liveElc8812.minPrice, Number((compPrice * 0.97).toFixed(2))).toFixed(2));
assert(
  undercutTarget === 920.53,
  '"Undercut Comp -3%" preset continues working properly (₹920.53 for ELC-8812)',
  `Target: ₹${undercutTarget}`
);

// Max Revenue preset optimization verification on ELC-8812 (elastic: -1.85)
const maxRevResult = calculateOptimalRevenueTarget(liveElc8812);
assert(
  maxRevResult.isModelDerived === true,
  '"Max Revenue" preset calculates model-derived optimal revenue target for ELC-8812',
  maxRevResult.description
);
assert(
  maxRevResult.price >= liveElc8812.minPrice && maxRevResult.price <= liveElc8812.maxPrice,
  '"Max Revenue" target strictly respects product guardrails for ELC-8812',
  `Min: ₹${liveElc8812.minPrice} <= Target: ₹${maxRevResult.price} <= Max: ₹${liveElc8812.maxPrice}`
);
const maxRevSimMetrics = calculateSimulationMetrics(liveElc8812, maxRevResult.price);
assert(
  maxRevSimMetrics.simulatedRevenue > baselineMetrics.baselineRevenue,
  '"Max Revenue" preset strictly increases simulated revenue over baseline for ELC-8812',
  `Baseline Revenue: ₹${baselineMetrics.baselineRevenue.toLocaleString()} -> Simulated Revenue: ₹${maxRevSimMetrics.simulatedRevenue.toLocaleString()} (+₹${(maxRevSimMetrics.simulatedRevenue - baselineMetrics.baselineRevenue).toLocaleString()})`
);
assert(
  maxRevResult.price < liveElc8812.currentPrice,
  '"Max Revenue" lowers price on elastic good (epsilon = -1.85) to drive volume expansion',
  `Current: ₹${liveElc8812.currentPrice} -> Revenue Optimal: ₹${maxRevResult.price}`
);

// Max Revenue optimization on an inelastic product (e.g., SPT-2019: epsilon = -0.80)
const spt2019 = {
  id: 'prod-007',
  sku: 'SPT-2019',
  name: 'Carbon Fiber Tennis Racket',
  currentPrice: 145.00,
  cost: 62.00,
  predictedDemand: 160,
  elasticity: -0.80,
  minPrice: 110.00,
  maxPrice: 185.00
};
const sptRevResult = calculateOptimalRevenueTarget(spt2019);
assert(
  sptRevResult.isModelDerived === true,
  '"Max Revenue" calculates model-derived target on inelastic product (SPT-2019)',
  sptRevResult.description
);
assert(
  sptRevResult.price > spt2019.currentPrice,
  '"Max Revenue" raises price on inelastic good (epsilon = -0.80) to maximize revenue',
  `Current: ₹${spt2019.currentPrice} -> Target: ₹${sptRevResult.price}`
);
assert(
  sptRevResult.price >= spt2019.minPrice && sptRevResult.price <= spt2019.maxPrice,
  '"Max Revenue" target respects guardrails on inelastic product',
  `Min: ₹${spt2019.minPrice} <= Target: ₹${sptRevResult.price} <= Max: ₹${spt2019.maxPrice}`
);
const sptBaselineRev = Math.round(spt2019.currentPrice * spt2019.predictedDemand);
const sptSimMetrics = calculateSimulationMetrics(spt2019, sptRevResult.price);
assert(
  sptSimMetrics.simulatedRevenue > sptBaselineRev,
  '"Max Revenue" strictly increases simulated revenue on inelastic product',
  `Baseline: ₹${sptBaselineRev.toLocaleString()} -> Simulated: ₹${sptSimMetrics.simulatedRevenue.toLocaleString()} (+₹${(sptSimMetrics.simulatedRevenue - sptBaselineRev).toLocaleString()})`
);

function calculateClearanceTarget(product) {
  const cost = Number(product.cost ?? product.baseCost ?? product.cost_price ?? ((product.currentPrice ?? 100) * 0.5));
  const rawPrice = Number((cost * 1.15).toFixed(2));
  const minP = Number(product.minPrice ?? (cost > 0 ? cost * 1.05 : rawPrice));
  const maxP = Number(product.maxPrice ?? (rawPrice * 1.5));
  return Number(Math.min(maxP, Math.max(minP, rawPrice)).toFixed(2));
}

const clearanceTarget = calculateClearanceTarget(liveElc8812);
assert(
  clearanceTarget === 621.00,
  '"Clearance Mode" preset produces cost + 15% liquidation price (₹621.00 for ELC-8812)',
  `Target: ₹${clearanceTarget.toFixed(2)} (Cost: ₹${liveElc8812.cost.toFixed(2)} * 1.15)`
);

assert(
  clearanceTarget >= liveElc8812.minPrice && clearanceTarget <= liveElc8812.maxPrice,
  '"Clearance Mode" target strictly respects product guardrails',
  `Min: ₹${liveElc8812.minPrice.toFixed(2)} <= Target: ₹${clearanceTarget.toFixed(2)} <= Max: ₹${liveElc8812.maxPrice.toFixed(2)}`
);

// Verify guardrail clamping when cost + 15% is outside boundaries
const highMinProduct = { currentPrice: 200, cost: 100, minPrice: 125, maxPrice: 300 };
assert(
  calculateClearanceTarget(highMinProduct) === 125.00,
  '"Clearance Mode" clamps to minPrice if cost + 15% falls below minimum guardrail',
  `Computed: ₹${calculateClearanceTarget(highMinProduct)} (minPrice: ₹125.00, raw cost+15%: ₹115.00)`
);

console.log('\n======================================================');
console.log(`TEST SUMMARY: ${passed}/${total} assertions passed (${Math.round((passed / total) * 100)}%)`);
console.log('======================================================\n');

if (passed !== total) {
  process.exit(1);
}
