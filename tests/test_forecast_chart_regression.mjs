import assert from 'node:assert';

// Simulated raw API response points from GET /api/forecast?time_range=7d
const liveApi7dPoints = [
  {
    date: "Fri",
    historical_sales: 449,
    predicted_demand: 473,
    lower_bound: 277,
    upper_bound: 661,
    actual_revenue: 156100.69,
    projected_revenue: 164444.6,
    promo_uplift: 38
  },
  {
    date: "Sat",
    historical_sales: 449,
    predicted_demand: 473,
    lower_bound: 268,
    upper_bound: 670,
    actual_revenue: 156100.69,
    projected_revenue: 164444.6,
    promo_uplift: 38
  },
  {
    date: "Sun",
    historical_sales: 518,
    predicted_demand: 545,
    lower_bound: 339,
    upper_bound: 750,
    actual_revenue: 180089.44,
    projected_revenue: 189476.34,
    promo_uplift: 44
  },
  {
    date: "Mon",
    historical_sales: 449,
    predicted_demand: 473,
    lower_bound: 259,
    upper_bound: 678,
    actual_revenue: 156100.69,
    projected_revenue: 164444.6,
    promo_uplift: 38
  },
  {
    date: "Tue",
    historical_sales: 432,
    predicted_demand: 455,
    lower_bound: 241,
    upper_bound: 670,
    actual_revenue: 150190.42,
    projected_revenue: 158186.67,
    promo_uplift: 36
  },
  {
    date: "Wed",
    historical_sales: 348,
    predicted_demand: 366,
    lower_bound: 152,
    upper_bound: 580,
    actual_revenue: 120986.73,
    projected_revenue: 127244.66,
    promo_uplift: 29
  },
  {
    date: "Thu",
    historical_sales: 390,
    predicted_demand: 411,
    lower_bound: 187,
    upper_bound: 625,
    actual_revenue: 135588.57,
    projected_revenue: 142889.5,
    promo_uplift: 33
  }
];

// Normalization function used in DemandForecastChart & DashboardPage
function normalizeChartData(data) {
  if (!data || !Array.isArray(data)) return [];
  return data.map(item => {
    const time = item.time || item.date || '';
    const baseline = Number(item.baseline ?? item.historical_sales ?? 0);
    const forecastP50 = Number(item.forecastP50 ?? item.predicted_demand ?? 0);
    const lowerP10 = Number(item.lowerP10 ?? item.lower_bound ?? 0);
    const upperP90 = Number(item.upperP90 ?? item.upper_bound ?? 0);
    const promoUplift = item.promoUplift !== undefined
      ? Number(item.promoUplift)
      : (item.promo_uplift !== undefined
        ? Number(item.promo_uplift)
        : (forecastP50 && lowerP10 ? Math.max(0, Math.round((forecastP50 - lowerP10) * 0.4)) : 0));

    return {
      ...item,
      time,
      date: item.date || item.time || '',
      baseline,
      historical_sales: baseline,
      forecastP50,
      predicted_demand: forecastP50,
      lowerP10,
      lower_bound: lowerP10,
      upperP90,
      upper_bound: upperP90,
      promoUplift,
      promo_uplift: promoUplift
    };
  });
}

function generateCsv(data) {
  const chartData = normalizeChartData(data);
  const header = 'Time,Historical Baseline,Projected Demand (P50),Lower P10,Upper P90,Promotional Surge,Actual Revenue (INR),Projected Revenue (INR)\n';
  const rows = chartData.map(d =>
    `"${d.time || d.date || ''}",${d.baseline ?? d.historical_sales ?? 0},${d.forecastP50 ?? d.predicted_demand ?? 0},${d.lowerP10 ?? d.lower_bound ?? 0},${d.upperP90 ?? d.upper_bound ?? 0},${d.promoUplift ?? d.promo_uplift ?? 0},${d.actual_revenue || 0},${d.projected_revenue || 0}`
  ).join('\n');
  return header + rows;
}

console.log("==================================================");
console.log("DEMAND FORECAST CHART NORMALIZATION REGRESSION TEST");
console.log("==================================================");

// Test 1: Normalize raw API data
const normalized = normalizeChartData(liveApi7dPoints);
assert.strictEqual(normalized.length, 7, "Output should contain 7 points");

normalized.forEach((pt, idx) => {
  assert(pt.time && typeof pt.time === 'string', `Point ${idx} should have valid time string: ${pt.time}`);
  assert(!isNaN(pt.forecastP50) && pt.forecastP50 > 0, `Point ${idx} forecastP50 should be positive number: ${pt.forecastP50}`);
  assert(!isNaN(pt.baseline) && pt.baseline > 0, `Point ${idx} baseline should be positive number: ${pt.baseline}`);
  assert(!isNaN(pt.lowerP10) && pt.lowerP10 > 0, `Point ${idx} lowerP10 should be positive number: ${pt.lowerP10}`);
  assert(!isNaN(pt.upperP90) && pt.upperP90 >= pt.forecastP50, `Point ${idx} upperP90 should be >= forecastP50: ${pt.upperP90}`);
  assert(!isNaN(pt.promoUplift) && pt.promoUplift >= 0, `Point ${idx} promoUplift should be non-negative: ${pt.promoUplift}`);
  assert.strictEqual(pt.lower_bound, pt.lowerP10, "Both lower_bound and lowerP10 keys must match");
  assert.strictEqual(pt.upper_bound, pt.upperP90, "Both upper_bound and upperP90 keys must match");
  assert.strictEqual(pt.predicted_demand, pt.forecastP50, "Both predicted_demand and forecastP50 keys must match");
  assert.strictEqual(pt.historical_sales, pt.baseline, "Both historical_sales and baseline keys must match");
});
console.log("[PASS] [01]: Raw API 7-day points normalize with all Recharts dataKeys mapped");

// Test 2: CSV Export
const csv = generateCsv(liveApi7dPoints);
assert(!csv.includes("undefined"), "CSV must not contain 'undefined'");
assert(!csv.includes("NaN"), "CSV must not contain 'NaN'");
assert(csv.includes('"Fri",449,473,277,661,38,'), "CSV must include exact row format for Fri point");
console.log("[PASS] [02]: CSV export produces valid rows with no undefined or NaN values");

// Test 3: Null and Empty Data Handling
assert.deepStrictEqual(normalizeChartData(null), [], "null input returns empty array");
assert.deepStrictEqual(normalizeChartData([]), [], "empty array input returns empty array");
assert.deepStrictEqual(normalizeChartData(undefined), [], "undefined input returns empty array");
console.log("[PASS] [03]: Null, undefined, and empty data handled gracefully");

// Test 4: Mock Data Format Compatibility
const mockPoints = [
  { time: "Mon", baseline: 320, forecastP50: 345, lowerP10: 310, upperP90: 380, promoUplift: 15 }
];
const normalizedMock = normalizeChartData(mockPoints);
assert.strictEqual(normalizedMock[0].time, "Mon");
assert.strictEqual(normalizedMock[0].forecastP50, 345);
assert.strictEqual(normalizedMock[0].predicted_demand, 345);
assert.strictEqual(normalizedMock[0].upperP90, 380);
assert.strictEqual(normalizedMock[0].lowerP10, 310);
console.log("[PASS] [04]: Existing mock data format remains 100% compatible");

console.log("\n==================================================");
console.log("ALL 4 REGRESSION CHECKS PASSED SUCCESSFULLY!");
console.log("==================================================");

