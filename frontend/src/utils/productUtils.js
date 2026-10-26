/**
 * Product Data Normalization and Metric Utilities for SmartPrice
 * Ensures seamless interop between backend API response (snake_case)
 * and legacy/frontend property conventions (camelCase).
 */

export const normalizeProduct = (p) => {
  if (!p) return null;

  const current_price = Number(
    p.current_price !== undefined ? p.current_price : (p.currentPrice !== undefined ? p.currentPrice : (p.sellingPrice || 0))
  );

  const cost_price = Number(
    p.cost_price !== undefined ? p.cost_price : (p.cost !== undefined ? p.cost : (p.baseCost !== undefined ? p.baseCost : (p.costPrice || 0)))
  );

  const stock_quantity = Number(
    p.stock_quantity !== undefined ? p.stock_quantity : (p.stock !== undefined ? p.stock : (p.stockQuantity || 0))
  );

  const reorder_level = Number(
    p.reorder_level !== undefined ? p.reorder_level : (p.minimum_stock !== undefined ? p.minimum_stock : (p.reorderLevel !== undefined ? p.reorderLevel : 30))
  );

  const safety_stock = Number(
    p.safety_stock !== undefined ? p.safety_stock : (p.safetyStock !== undefined ? p.safetyStock : 15)
  );

  const recommended_price = Number(
    p.recommended_price !== undefined ? p.recommended_price : (p.recommendedPrice !== undefined ? p.recommendedPrice : current_price)
  );

  const predicted_demand = Number(
    p.predicted_demand !== undefined ? p.predicted_demand : (p.predictedDemand !== undefined ? p.predictedDemand : 100)
  );

  const elasticity = Number(
    p.elasticity !== undefined ? p.elasticity : -1.25
  );

  const competitor_price = Number(
    p.competitor_price !== undefined ? p.competitor_price : (p.competitorPrice !== undefined ? p.competitorPrice : current_price)
  );

  const status = p.status || (stock_quantity <= 0 ? 'Out of Stock' : stock_quantity <= reorder_level ? 'Low Stock' : 'Optimal');

  return {
    ...p,
    id: p.id || p.sku,
    sku: p.sku || p.id,
    name: p.name || 'Unnamed Product',
    category: p.category || 'General',
    supplier: p.supplier || 'Global Direct Vendor Ltd.',
    rating: Number(p.rating ?? 4.5),
    status,

    // Both snake_case and camelCase
    current_price,
    currentPrice: current_price,
    sellingPrice: current_price,

    cost_price,
    cost: cost_price,
    baseCost: cost_price,
    costPrice: cost_price,

    stock_quantity,
    stock: stock_quantity,
    stockQuantity: stock_quantity,

    reorder_level,
    reorderLevel: reorder_level,
    minimum_stock: reorder_level,

    safety_stock,
    safetyStock: safety_stock,

    recommended_price,
    recommendedPrice: recommended_price,

    predicted_demand,
    predictedDemand: predicted_demand,

    elasticity,
    competitor_price,
    competitorPrice: competitor_price,

    dynamicPricing: p.dynamicPricing !== undefined
      ? Boolean(p.dynamicPricing)
      : (p.dynamic_pricing !== undefined ? Boolean(p.dynamic_pricing) : true),
    dynamic_pricing: p.dynamic_pricing !== undefined
      ? Boolean(p.dynamic_pricing)
      : (p.dynamicPricing !== undefined ? Boolean(p.dynamicPricing) : true),
    has_active_recommendation: Boolean(p.has_active_recommendation),
    hasActiveRecommendation: Boolean(p.has_active_recommendation || p.hasActiveRecommendation),
    has_historical_override: Boolean(p.has_historical_override),
    hasHistoricalOverride: Boolean(p.has_historical_override || p.hasHistoricalOverride),
    historical_override_price: p.historical_override_price !== undefined ? p.historical_override_price : (p.historicalOverridePrice ?? null),
    historicalOverridePrice: p.historical_override_price !== undefined ? p.historical_override_price : (p.historicalOverridePrice ?? null),
    override_reason: p.override_reason || p.overrideReason || null,
    overrideReason: p.override_reason || p.overrideReason || null,
    expectedRevenue: p.expectedRevenue ?? Math.round(current_price * predicted_demand),
    aiConfidence: p.aiConfidence || '92%',
    salesVelocity: p.salesVelocity || (stock_quantity > 50 ? 'High' : 'Moderate'),
    created_at: p.created_at || new Date().toISOString(),
    updated_at: p.updated_at || new Date().toISOString()
  };
};

export const calculateProductSummaryMetrics = (products = []) => {
  const safeProducts = Array.isArray(products) ? products : [];
  const total = safeProducts.length;
  const activeProducts = safeProducts.filter(p => p.status !== 'Out of Stock' && p.status !== 'Inactive').length;
  const lowStock = safeProducts.filter(p => {
    const stock = p.stock_quantity ?? p.stock ?? 0;
    const minStock = p.reorder_level ?? p.minimum_stock ?? p.reorderLevel ?? 30;
    return p.status === 'Low Stock' || p.status === 'Critical' || stock <= minStock;
  }).length;
  const avgPrice = total > 0
    ? (safeProducts.reduce((acc, p) => acc + (p.current_price ?? p.currentPrice ?? 0), 0) / total)
    : 0;
  const dynamicCount = safeProducts.filter(p => p.dynamicPricing).length;

  return {
    total,
    activeProducts,
    lowStock,
    avgPrice,
    dynamicCount
  };
};

export const normalizeOptimization = (opt) => {
  if (!opt) return null;

  const currentPrice = Number(
    opt.current_price !== undefined ? opt.current_price : (opt.currentPrice !== undefined ? opt.currentPrice : 0)
  );

  const recommendedPrice = Number(
    opt.recommended_price !== undefined ? opt.recommended_price : (opt.recommendedPrice !== undefined ? opt.recommendedPrice : currentPrice)
  );

  const costPrice = Number(
    opt.cost_price !== undefined ? opt.cost_price : (opt.costPrice !== undefined ? opt.costPrice : (opt.cost !== undefined ? opt.cost : 0))
  );

  const competitorPrice = Number(
    opt.competitor_price !== undefined ? opt.competitor_price : (opt.competitorPrice !== undefined ? opt.competitorPrice : 0)
  );

  const expectedDemand = Number(
    opt.expected_demand !== undefined ? opt.expected_demand : (opt.expectedDemand !== undefined ? opt.expectedDemand : 100)
  );

  const baselineDemand = Number(
    opt.baseline_demand !== undefined ? opt.baseline_demand : (opt.baselineDemand !== undefined ? opt.baselineDemand : expectedDemand)
  );

  const priceDeltaVal = Number(
    opt.price_delta_val !== undefined ? opt.price_delta_val : Number((recommendedPrice - currentPrice).toFixed(2))
  );

  const revenueLiftVal = Number(
    opt.revenue_lift_val !== undefined ? opt.revenue_lift_val : 0
  );

  const profitLiftVal = Number(
    opt.profit_lift_val !== undefined ? opt.profit_lift_val : 0
  );

  const priceDelta = opt.price_delta || (
    priceDeltaVal > 0 ? `+₹${priceDeltaVal.toFixed(2)}` : priceDeltaVal < 0 ? `-₹${Math.abs(priceDeltaVal).toFixed(2)}` : '₹0.00'
  );

  const priceChangePctVal = Number(
    opt.price_change_pct_val !== undefined
      ? opt.price_change_pct_val
      : (currentPrice > 0 ? Number(((priceDeltaVal / currentPrice) * 100).toFixed(1)) : 0)
  );

  const priceChangePct = opt.price_change_pct || (
    priceChangePctVal > 0 ? `+${priceChangePctVal.toFixed(1)}%` : priceChangePctVal < 0 ? `${priceChangePctVal.toFixed(1)}%` : '+0.0%'
  );

  const isStale = Boolean(
    opt.is_stale || opt.isStale || (opt.status === 'Pending Approval' && currentPrice === recommendedPrice)
  );

  const stockQuantity = Number(
    opt.stock_quantity !== undefined ? opt.stock_quantity : (opt.stockQuantity !== undefined ? opt.stockQuantity : (opt.stock || 0))
  );

  const reorderLevel = Number(
    opt.reorder_level !== undefined ? opt.reorder_level : (opt.reorderLevel !== undefined ? opt.reorderLevel : 30)
  );

  const safetyStock = Number(
    opt.safety_stock !== undefined ? opt.safety_stock : (opt.safetyStock !== undefined ? opt.safetyStock : 15)
  );

  const stockStatus = opt.stock_status || opt.stockStatus || (
    stockQuantity <= safetyStock ? 'Critical' : stockQuantity <= reorderLevel ? 'Low Stock' : stockQuantity > (reorderLevel * 2.5) ? 'Overstocked' : 'Optimal'
  );

  const costFloor = Number(
    opt.cost_floor !== undefined ? opt.cost_floor : (opt.costFloor !== undefined ? opt.costFloor : costPrice)
  );

  const minGuardrail = Number(
    opt.min_guardrail !== undefined ? opt.min_guardrail : (opt.minGuardrail !== undefined ? opt.minGuardrail : Number((costPrice * 1.05).toFixed(2)))
  );

  const maxGuardrail = Number(
    opt.max_guardrail !== undefined ? opt.max_guardrail : (opt.maxGuardrail !== undefined ? opt.maxGuardrail : Number((currentPrice * 1.35).toFixed(2)))
  );

  return {
    ...opt,
    id: opt.id,
    productId: opt.product_id || opt.productId,
    product_id: opt.product_id || opt.productId,
    sku: opt.sku || '',
    productName: opt.product_name || opt.productName || 'Product',
    product_name: opt.product_name || opt.productName || 'Product',
    category: opt.category || 'General',
    currentPrice,
    current_price: currentPrice,
    recommendedPrice,
    recommended_price: recommendedPrice,
    costPrice,
    cost_price: costPrice,
    competitorPrice,
    competitor_price: competitorPrice,
    priceDelta,
    price_delta: priceDelta,
    priceDeltaVal,
    price_delta_val: priceDeltaVal,
    priceChangePct,
    price_change_pct: priceChangePct,
    priceChangePctVal,
    price_change_pct_val: priceChangePctVal,
    stockQuantity,
    stock_quantity: stockQuantity,
    reorderLevel,
    reorder_level: reorderLevel,
    safetyStock,
    safety_stock: safetyStock,
    stockStatus,
    stock_status: stockStatus,
    costFloor,
    cost_floor: costFloor,
    minGuardrail,
    min_guardrail: minGuardrail,
    maxGuardrail,
    max_guardrail: maxGuardrail,
    guardrailDetails: opt.guardrail_details || opt.guardrailDetails || `Cost floor: ₹${costFloor.toFixed(2)} | Min: ₹${minGuardrail.toFixed(2)} | Max: ₹${maxGuardrail.toFixed(2)}`,
    pricingDrivers: opt.pricing_drivers || opt.pricingDrivers || null,
    expectedDemand,
    expected_demand: expectedDemand,
    baselineDemand,
    baseline_demand: baselineDemand,
    demandDelta: opt.demand_delta || opt.demandDelta || '+0.0%',
    demand_delta: opt.demand_delta || opt.demandDelta || '+0.0%',
    revenueLift: opt.revenue_lift || opt.revenueLift || '+0.0%',
    revenue_lift: opt.revenue_lift || opt.revenueLift || '+0.0%',
    revenueLiftVal,
    revenue_lift_val: revenueLiftVal,
    profitLift: opt.profit_lift || opt.profitLift || '+0.0%',
    profit_lift: opt.profit_lift || opt.profitLift || '+0.0%',
    profitLiftVal,
    profit_lift_val: profitLiftVal,
    expectedMargin: opt.expected_margin || opt.expectedMargin || '50.0%',
    expected_margin: opt.expected_margin || opt.expectedMargin || '50.0%',
    marginDelta: opt.margin_delta || opt.marginDelta || '+0.0%',
    elasticityScore: Number(opt.elasticity_score !== undefined ? opt.elasticity_score : (opt.elasticityScore !== undefined ? opt.elasticityScore : -1.25)),
    elasticityLabel: opt.elasticity_label || opt.elasticityLabel || 'Moderately Elastic',
    elasticitySource: opt.elasticity_source || opt.elasticitySource || 'fallback_catalog',
    elasticityReliable: Boolean(opt.elasticity_reliable !== undefined ? opt.elasticity_reliable : opt.elasticityReliable),
    elasticityStatus: opt.elasticity_status || opt.elasticityStatus || 'CATALOG_FALLBACK',
    rationale: opt.rationale || opt.reason || '',
    status: opt.status || 'Pending Approval',
    isStale,
    is_stale: isStale,
    staleReason: opt.stale_reason || opt.staleReason || (isStale ? `Product is already priced at ₹${currentPrice.toFixed(2)}.` : null),
    guardrailStatus: opt.guardrail_status || opt.guardrailStatus || 'Pass'
  };
};

/**
 * Normalizes an inventory transaction record ensuring consistent field mapping
 * for remaining_stock, new_stock, and formatted transaction date.
 */
export const normalizeInventoryTransaction = (tx) => {
  if (!tx) return null;
  const remaining_stock = tx.remaining_stock !== undefined
    ? Number(tx.remaining_stock)
    : (tx.new_stock !== undefined ? Number(tx.new_stock) : (tx.remainingStock !== undefined ? Number(tx.remainingStock) : 0));

  let date = tx.date;
  if (!date && tx.created_at) {
    date = typeof tx.created_at === 'string'
      ? tx.created_at.replace('T', ' ').substring(0, 16)
      : new Date(tx.created_at).toISOString().replace('T', ' ').substring(0, 16);
  }

  return {
    ...tx,
    remaining_stock,
    remainingStock: remaining_stock,
    new_stock: remaining_stock,
    date: date || '—'
  };
};

