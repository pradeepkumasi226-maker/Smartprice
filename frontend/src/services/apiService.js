import { mockProducts } from '../data/mockProducts.js';
import { mockSales } from '../data/mockSales.js';
import { mockInventory, mockInventorySummary } from '../data/mockInventory.js';
import { mockRevenueTrends, mockDemandTimeline, mockSeasonalityDrivers } from '../data/mockForecasts.js';
import { mockOptimizations, mockElasticityCurves } from '../data/mockOptimizations.js';
import { mockGlobalFeatureImportance, mockProductShapDecomposition } from '../data/mockShapData.js';
import { mockReportsData } from '../data/mockReports.js';
import { mockAlerts } from '../data/mockAlerts.js';
import { normalizeProduct, normalizeOptimization } from '../utils/productUtils.js';

const delay = (ms = 100) => new Promise(resolve => setTimeout(resolve, ms));

export const apiService = {
  // ----------------------------------------------------
  // Authentication & Session Headers
  // ----------------------------------------------------
  getAuthHeaders() {
    try {
      const raw = localStorage.getItem('smartprice_session');
      if (raw) {
        const session = JSON.parse(raw);
        if (session && session.token) {
          return { 'Authorization': `Bearer ${session.token}` };
        }
      }
    } catch (e) {
      // ignore
    }
    return {};
  },

  async login(credentials = {}) {
    const { identifier = 'pradeep.retail@smartprice.ai', password } =
      typeof credentials === 'string' ? { identifier: credentials } : credentials;

    const trimmedId = (identifier || '').trim();
    if (!trimmedId) {
      throw new Error('Please enter your email or username.');
    }
    if (!password) {
      throw new Error('Password is required.');
    }

    const resp = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: trimmedId, password })
    });

    if (resp.ok) {
      const data = await resp.json();
      return {
        success: true,
        session: data.session,
        user: data.user
      };
    } else {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || 'Authentication failed. Please verify your credentials.');
    }
  },

  async getCurrentUser() {
    try {
      const resp = await fetch('/api/auth/me', {
        headers: { ...this.getAuthHeaders() }
      });
      if (resp.ok) return await resp.json();
    } catch (e) {
      // ignore
    }
    return null;
  },

  // ----------------------------------------------------
  // Products Catalog
  // ----------------------------------------------------
  async getProducts() {
    const resp = await fetch('/api/products');
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map(normalizeProduct);
      }
    }
    throw new Error(`Failed to fetch products from backend: HTTP ${resp.status}`);
  },

  async getProductById(id) {
    const resp = await fetch(`/api/products/${encodeURIComponent(id)}`);
    if (resp.ok) {
      const data = await resp.json();
      return normalizeProduct(data);
    }
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Product ${id} not found.`);
  },

  async createProduct(productData) {
    const payload = {
      sku: productData.sku,
      name: productData.name,
      category: productData.category,
      current_price: Number(productData.current_price ?? productData.currentPrice ?? 0),
      cost_price: Number(productData.cost_price ?? productData.cost ?? 0),
      competitor_price: Number(productData.competitor_price ?? productData.competitorPrice ?? 0),
      stock_quantity: Number(productData.stock_quantity ?? productData.stock ?? 0),
      reorder_level: Number(productData.reorder_level ?? productData.reorderLevel ?? productData.minimum_stock ?? 30),
      safety_stock: Number(productData.safety_stock ?? productData.safetyStock ?? 15),
      supplier: productData.supplier || "Global Direct Vendor Ltd.",
      rating: Number(productData.rating || 4.5),
      elasticity: Number(productData.elasticity || -1.25),
      predicted_demand: Number(productData.predicted_demand ?? productData.predictedDemand ?? 100),
      dynamic_pricing: Boolean(productData.dynamic_pricing ?? productData.dynamicPricing ?? true)
    };

    const resp = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() },
      body: JSON.stringify(payload)
    });
    if (resp.ok) {
      const data = await resp.json();
      return normalizeProduct(data);
    }
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to create product on backend (HTTP ${resp.status})`);
  },

  async updateProduct(skuOrId, updateData) {
    const payload = {};
    if (updateData.name !== undefined) payload.name = updateData.name;
    if (updateData.category !== undefined) payload.category = updateData.category;
    if (updateData.current_price !== undefined || updateData.currentPrice !== undefined) {
      payload.current_price = Number(updateData.current_price ?? updateData.currentPrice);
    }
    if (updateData.cost_price !== undefined || updateData.cost !== undefined) {
      payload.cost_price = Number(updateData.cost_price ?? updateData.cost);
    }
    if (updateData.stock_quantity !== undefined || updateData.stock !== undefined) {
      payload.stock_quantity = Number(updateData.stock_quantity ?? updateData.stock);
    }
    if (updateData.reorder_level !== undefined || updateData.minimum_stock !== undefined || updateData.reorderLevel !== undefined) {
      payload.reorder_level = Number(updateData.reorder_level ?? updateData.minimum_stock ?? updateData.reorderLevel);
    }
    if (updateData.safety_stock !== undefined || updateData.safetyStock !== undefined) {
      payload.safety_stock = Number(updateData.safety_stock ?? updateData.safetyStock);
    }
    if (updateData.supplier !== undefined) payload.supplier = updateData.supplier;
    if (updateData.rating !== undefined) payload.rating = Number(updateData.rating);
    if (updateData.elasticity !== undefined) payload.elasticity = Number(updateData.elasticity);
    if (updateData.predicted_demand !== undefined || updateData.predictedDemand !== undefined) {
      payload.predicted_demand = Number(updateData.predicted_demand ?? updateData.predictedDemand);
    }
    if (updateData.competitor_price !== undefined || updateData.competitorPrice !== undefined) {
      payload.competitor_price = Number(updateData.competitor_price ?? updateData.competitorPrice);
    }
    if (updateData.dynamic_pricing !== undefined || updateData.dynamicPricing !== undefined) {
      payload.dynamic_pricing = Boolean(updateData.dynamic_pricing ?? updateData.dynamicPricing);
    }

    const resp = await fetch(`/api/products/${encodeURIComponent(skuOrId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() },
      body: JSON.stringify(payload)
    });
    if (resp.ok) {
      const data = await resp.json();
      return normalizeProduct(data);
    }
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to update product on backend (HTTP ${resp.status})`);
  },

  async deleteProduct(skuOrId) {
    const resp = await fetch(`/api/products/${encodeURIComponent(skuOrId)}`, {
      method: 'DELETE',
      headers: { ...this.getAuthHeaders() }
    });
    if (resp.ok) return await resp.json();
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to delete product on backend (HTTP ${resp.status})`);
  },

  async batchDeleteProducts(productIds) {
    const resp = await fetch('/api/products/batch-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() },
      body: JSON.stringify({ product_ids: productIds })
    });
    if (resp.ok) return await resp.json();
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to batch delete products (HTTP ${resp.status})`);
  },

  async batchApplyAiPrices(productIds) {
    const resp = await fetch('/api/products/batch-apply-ai-prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() },
      body: JSON.stringify({ product_ids: productIds })
    });
    if (resp.ok) return await resp.json();
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to apply AI prices in batch (HTTP ${resp.status})`);
  },

  // ----------------------------------------------------
  // Sales & Revenue Trends
  // ----------------------------------------------------
  async getSales() {
    await delay(100);
    return [...mockSales];
  },

  async getRevenueTrends() {
    await delay(100);
    return [...mockRevenueTrends];
  },

  // ----------------------------------------------------
  // Demand Forecast
  // ----------------------------------------------------
  async getDemandForecast(timeRange = '7d', sku = null) {
    await delay(50);
    try {
      const params = new URLSearchParams();
      if (timeRange) params.append('time_range', timeRange);
      if (sku && sku !== 'All') params.append('sku', sku);
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const resp = await fetch(`/api/forecast${queryString}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data && Array.isArray(data.points)) {
          return data;
        }
      } else {
        console.warn(`GET /api/forecast responded with status ${resp.status}`);
      }
    } catch (e) {
      console.warn('Backend /api/forecast unreachable, using fallback dataset:', e.message);
    }

    const fallbackPoints = mockDemandTimeline[timeRange] || mockDemandTimeline['7d'];
    const totalHist = fallbackPoints.reduce((acc, p) => acc + (p.baseline || 0), 0);
    const totalPred = fallbackPoints.reduce((acc, p) => acc + (p.forecastP50 || 0), 0);

    return {
      time_range: timeRange,
      model_name: "Empirical Time-Series Baseline (7d Moving Average)",
      accuracy_metric: "Empirical Baseline (Sample Size: 16 days)",
      data_source: "Local Catalog Cache & Seeded Sales History",
      methodology_note: "Projections derived from empirical sales transactions and day-of-week baseline. At least 90+ days of sales records across multiple seasonal cycles are recommended for ML training.",
      currency: "INR",
      currency_symbol: "₹",
      sku: sku !== 'All' ? sku : null,
      total_historical_sales: totalHist,
      total_predicted_demand: totalPred,
      total_actual_revenue: totalHist * 199.0,
      total_projected_revenue: totalPred * 199.0,
      points: fallbackPoints.map(item => ({
        date: item.time,
        historical_sales: item.baseline,
        predicted_demand: item.forecastP50,
        lower_bound: item.lowerP10,
        upper_bound: item.upperP90,
        actual_revenue: item.baseline ? item.baseline * 199.0 : null,
        projected_revenue: item.forecastP50 ? item.forecastP50 * 199.0 : null,
        time: item.time,
        baseline: item.baseline,
        forecastP50: item.forecastP50,
        lowerP10: item.lowerP10,
        upperP90: item.upperP90,
        promo_uplift: item.promoUplift,
        promoUplift: item.promoUplift
      }))
    };
  },

  async getProductForecasts(timeRange = '7d') {
    await delay(50);
    try {
      const resp = await fetch(`/api/forecast/products?time_range=${timeRange}`);
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
      }
    } catch (e) {
      console.warn('Backend /api/forecast/products unreachable, calculating from catalog:', e.message);
    }

    const multiplier = timeRange === '7d' ? 1.0 : timeRange === '30d' ? 4.2 : 12.5;
    const daysInHorizon = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;

    return mockProducts.map(p => {
      const pred = Math.round((p.predictedDemand || 100) * multiplier);
      const price = Number(p.currentPrice || 100);
      const cost = Number(p.cost || price * 0.5);
      const stock = Number(p.stock || 50);
      const dailyRate = Math.max(0.1, pred / daysInHorizon);
      const daysOfSupply = Number((stock / dailyRate).toFixed(1));
      const safety = Number(p.safetyStock || 10);
      
      let stockoutRisk = 'Low';
      if (stock <= safety) stockoutRisk = 'Critical';
      else if (daysOfSupply < 7) stockoutRisk = 'High';
      else if (daysOfSupply < 14) stockoutRisk = 'Medium';

      return {
        product_id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        current_price: price,
        cost_price: cost,
        stock_quantity: stock,
        reorder_level: Number(p.reorderLevel || 20),
        safety_stock: safety,
        historical_sales_units: Math.round(pred * 0.92),
        historical_revenue: Math.round(pred * 0.92 * price),
        predicted_demand_units: pred,
        projected_revenue: Math.round(pred * price),
        lower_bound_units: Math.round(pred * 0.90),
        upper_bound_units: Math.round(pred * 1.15),
        stockout_risk: stockoutRisk,
        days_of_supply: daysOfSupply,
        sales_velocity: dailyRate >= 5.0 ? 'High' : dailyRate >= 2.0 ? 'Moderate' : 'Steady',
        elasticity: Number(p.elasticity || -1.2)
      };
    });
  },


  async getSeasonalityDrivers() {
    await delay(50);
    try {
      const resp = await fetch('/api/forecast/seasonality');
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
      } else {
        console.warn(`GET /api/forecast/seasonality responded with status ${resp.status}`);
      }
    } catch (e) {
      console.warn('Backend /api/forecast/seasonality unreachable, using fallback dataset:', e.message);
    }
    return [...mockSeasonalityDrivers];
  },

  // ----------------------------------------------------
  // Dynamic Pricing Optimizations
  // ----------------------------------------------------
  async getOptimizations(options = {}) {
    await delay(50);
    const includeAll = options.include_all !== false;
    const query = new URLSearchParams();
    if (includeAll) query.append('include_all', 'true');
    if (options.min_margin_pct !== undefined) query.append('min_margin_pct', options.min_margin_pct);
    if (options.max_price_change_pct !== undefined) query.append('max_price_change_pct', options.max_price_change_pct);
    if (options.allow_below_cost !== undefined) query.append('allow_below_cost', options.allow_below_cost);

    const queryString = query.toString() ? `?${query.toString()}` : '';

    try {
      const resp = await fetch(`/api/pricing/recommendations${queryString}`);
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          return data.map(normalizeOptimization);
        }
      }
    } catch (e) {
      console.warn('Backend /api/pricing/recommendations offline, using local fallback dataset:', e.message);
    }

    // Comprehensive fallback ensuring all catalog products have dynamic pricing recommendations
    const existingMap = new Map(mockOptimizations.map(o => [o.sku, o]));
    const fullFallback = mockProducts.map(prod => {
      if (existingMap.has(prod.sku)) {
        return existingMap.get(prod.sku);
      }
      const p = Number(prod.currentPrice || prod.current_price || 100);
      const c = Number(prod.cost || prod.cost_price || p * 0.5);
      const comp = Number(prod.competitorPrice || prod.competitor_price || p * 1.05);
      const elasticity = Number(prod.elasticity || -1.25);
      const stock = Number(prod.stock || prod.stock_quantity || 50);
      const reorder = Number(prod.reorderLevel || prod.reorder_level || 30);
      const safety = Number(prod.safetyStock || prod.safety_stock || 15);

      // Deterministic dynamic price logic
      let shift = 0.05;
      if (stock <= safety) shift = 0.08;
      else if (stock <= reorder) shift = 0.04;
      else if (stock > reorder * 2.5) shift = -0.04;
      else if (comp > p) shift = Math.min(0.08, (comp - p) / p * 0.7);

      const recP = Number(Math.max(c * 1.05, p * (1 + shift)).toFixed(2));
      const deltaVal = Number((recP - p).toFixed(2));
      const pctVal = Number(((deltaVal / p) * 100).toFixed(1));

      return {
        id: `opt-${prod.id}`,
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        category: prod.category || 'General',
        currentPrice: p,
        recommendedPrice: recP,
        costPrice: c,
        competitorPrice: comp,
        priceDelta: deltaVal > 0 ? `+₹${deltaVal.toFixed(2)}` : deltaVal < 0 ? `-₹${Math.abs(deltaVal).toFixed(2)}` : '₹0.00',
        priceDeltaVal: deltaVal,
        priceChangePct: pctVal > 0 ? `+${pctVal.toFixed(1)}%` : `${pctVal.toFixed(1)}%`,
        priceChangePctVal: pctVal,
        stockQuantity: stock,
        reorderLevel: reorder,
        safetyStock: safety,
        stockStatus: stock <= safety ? 'Critical' : stock <= reorder ? 'Low Stock' : stock > reorder * 2.5 ? 'Overstocked' : 'Optimal',
        expectedDemand: Math.max(10, Math.round((prod.predictedDemand || 100) * (1 + (elasticity * (shift))))),
        demandDelta: shift < 0 ? `+${Math.abs(Math.round(shift * elasticity * 100))}%` : `-${Math.abs(Math.round(shift * elasticity * 100))}%`,
        revenueLift: `${shift >= 0 ? '+' : ''}${(shift * 100 * 0.8).toFixed(1)}%`,
        profitLift: `${shift >= 0 ? '+' : ''}${(shift * 100 * 1.2).toFixed(1)}%`,
        expectedMargin: `${(((recP - c) / recP) * 100).toFixed(1)}%`,
        marginDelta: '+2.5%',
        elasticityScore: elasticity,
        elasticityLabel: Math.abs(elasticity) > 1.5 ? 'Highly Elastic' : Math.abs(elasticity) >= 1.0 ? 'Moderately Elastic' : 'Inelastic',
        guardrailStatus: 'Pass',
        status: 'Pending Approval',
        isStale: false,
        staleReason: null,
        rationale: `Dynamic pricing algorithm calculated based on elasticity ${elasticity}, stock level (${stock} units), and cost floor ₹${c.toFixed(2)}.`
      };
    });

    return fullFallback.map(normalizeOptimization);
  },

  async generateRecommendations(guardrails = {}) {
    await delay(100);
    try {
      const resp = await fetch('/api/pricing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() },
        body: JSON.stringify(guardrails)
      });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          return data.map(normalizeOptimization);
        }
      }
    } catch (e) {
      console.warn('generateRecommendations API error, using fallback:', e.message);
    }
    return this.getOptimizations({ include_all: true, ...guardrails });
  },

  async approvePrice(sku, approvedPrice = null, user = 'Retail Pricing Manager', allowBelowCost = false) {
    const resp = await fetch(`/api/pricing/${encodeURIComponent(sku)}/approve?allow_below_cost=${Boolean(allowBelowCost)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() },
      body: JSON.stringify({ approved_price: approvedPrice, user })
    });
    if (resp.ok) return await resp.json();
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Price approval failed on server (HTTP ${resp.status})`);
  },

  async rejectPrice(sku, user = 'Retail Pricing Manager') {
    const resp = await fetch(`/api/pricing/${encodeURIComponent(sku)}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() },
      body: JSON.stringify({ user })
    });
    if (resp.ok) return await resp.json();
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Price rejection failed on server (HTTP ${resp.status})`);
  },

  async recalculateRecommendation(sku, guardrails = null) {
    const resp = await fetch(`/api/pricing/${encodeURIComponent(sku)}/recalculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() },
      body: guardrails ? JSON.stringify(guardrails) : undefined
    });
    if (resp.ok) {
      return await resp.json();
    }
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Price recalculation failed on server (HTTP ${resp.status})`);
  },

  async getElasticityCurve(productId, productObj = null) {
    await delay(100);
    if (mockElasticityCurves[productId]) {
      return mockElasticityCurves[productId].map(pt => ({
        ...pt,
        profit: pt.profit !== undefined ? pt.profit : Math.round((pt.revenue || 0) * 0.45)
      }));
    }
    const prod = productObj || mockProducts.find(p => p.id === productId || p.sku === productId) || { currentPrice: 100, cost: 50 };
    const price = Number(prod.currentPrice || prod.current_price || 100);
    const cost = Number(prod.cost || prod.baseCost || price * 0.5);
    const steps = [-0.20, -0.10, 0, 0.08, 0.15, 0.25];
    return steps.map(pct => {
      const p = Number((price * (1 + pct)).toFixed(2));
      const demand = Math.max(10, Math.round(150 * Math.pow(Math.max(0.1, p / price), -1.25)));
      const revenue = Math.round(p * demand);
      const profit = Math.round((p - cost) * demand);
      const margin = p > 0 ? (((p - cost) / p) * 100).toFixed(1) + '%' : '0.0%';
      return { price: p, demand, revenue, profit, margin };
    });
  },

  // ----------------------------------------------------
  // What-If Dynamic Pricing Simulation
  // ----------------------------------------------------
  async simulateWhatIf(productId, simulatedPrice, extraOptions = {}) {
    await delay(100);
    const prod = mockProducts.find(p => p.id === productId || p.sku === productId) || mockProducts[0];
    const currentP = prod.current_price || prod.currentPrice;
    const baseC = prod.cost || prod.baseCost;
    const elasticityMultiplier = extraOptions.elasticityMultiplier || 1.0;
    const competitorOffset = extraOptions.competitorOffset || 0.0;
    const promoDiscount = extraOptions.promoDiscount || 0.0;

    const pricePercentDelta = (simulatedPrice - currentP) / currentP;
    const effectiveElasticity = (prod.elasticity || -1.35) * elasticityMultiplier;
    const promoBoost = (promoDiscount / 100) * 0.4;
    const demandPercentDelta = (effectiveElasticity * pricePercentDelta) + promoBoost;

    const simulatedDemand = Math.max(10, Math.round((prod.predictedDemand || 300) * (1 + demandPercentDelta)));
    const simulatedRevenue = Math.round(simulatedPrice * simulatedDemand);
    const baselineRevenue = Math.round(currentP * (prod.predictedDemand || 300));
    const revenueDelta = simulatedRevenue - baselineRevenue;
    const revenuePercentDelta = ((revenueDelta / baselineRevenue) * 100).toFixed(1);

    const simulatedCost = baseC * simulatedDemand;
    const simulatedProfit = simulatedRevenue - simulatedCost;
    const baselineCost = baseC * (prod.predictedDemand || 300);
    const baselineProfit = baselineRevenue - baselineCost;
    const profitDelta = simulatedProfit - baselineProfit;
    const marginPercent = (((simulatedRevenue - simulatedCost) / simulatedRevenue) * 100).toFixed(1);

    let compPrice = prod.competitorPrice || prod.competitor_price || (currentP * 1.05);
    if (competitorOffset !== 0) {
      compPrice = Number((compPrice * (1 + (competitorOffset / 100))).toFixed(2));
    }

    return {
      product: prod,
      simulatedPrice: Number(simulatedPrice.toFixed(2)),
      baselinePrice: currentP,
      simulatedDemand,
      baselineDemand: prod.predictedDemand || 300,
      demandPercentDelta: (demandPercentDelta * 100).toFixed(1),
      simulatedRevenue,
      baselineRevenue,
      revenueDelta,
      revenuePercentDelta,
      simulatedProfit,
      baselineProfit,
      profitDelta,
      marginPercent: `${marginPercent}%`,
      competitorPrice: compPrice,
      isPriceHigherThanCompetitor: simulatedPrice > compPrice
    };
  },

  async getSavedScenarios() {
    const resp = await fetch('/api/what-if/scenarios');
    if (resp.ok) return await resp.json();
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch scenarios from backend: HTTP ${resp.status}`);
  },

  async saveScenario(scenario) {
    const payload = {
      product_id: scenario.productId || scenario.product_id,
      name: scenario.name,
      current_price: Number(scenario.currentPrice ?? scenario.current_price ?? scenario.baselinePrice ?? 0),
      simulated_price: Number(scenario.simulatedPrice ?? scenario.simulated_price ?? 0),
      expected_demand: Number(scenario.expectedDemand ?? scenario.expected_demand ?? scenario.simulatedDemand ?? 100),
      expected_revenue: Number(scenario.expectedRevenue ?? scenario.expected_revenue ?? scenario.simulatedRevenue ?? 0),
      expected_margin: String(scenario.expectedMargin ?? scenario.expected_margin ?? scenario.simulatedGrossMargin ?? '0%'),
      expected_gross_profit: Number(scenario.expectedGrossProfit ?? scenario.expected_gross_profit ?? scenario.simulatedProfit ?? scenario.grossProfit ?? 0),
      status: scenario.status || scenario.scenarioStatus || "Staged Draft"
    };
    const resp = await fetch('/api/what-if/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() },
      body: JSON.stringify(payload)
    });
    if (resp.ok) return await resp.json();
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to save scenario on server (HTTP ${resp.status})`);
  },

  async deleteScenario(id) {
    const resp = await fetch(`/api/what-if/scenarios/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { ...this.getAuthHeaders() }
    });
    if (resp.ok) return await resp.json();
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to delete scenario from server (HTTP ${resp.status})`);
  },

  // ----------------------------------------------------
  // Inventory Management
  // ----------------------------------------------------
  async getInventoryData() {
    const resp = await fetch('/api/inventory');
    if (resp.ok) return await resp.json();
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch inventory data (HTTP ${resp.status})`);
  },

  async restockProduct(sku, quantity, user = 'Retail Operations Manager', notes = null) {
    const resp = await fetch(`/api/inventory/${encodeURIComponent(sku)}/restock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() },
      body: JSON.stringify({ quantity: Number(quantity), user, notes })
    });
    if (resp.ok) return await resp.json();
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to restock product on server (HTTP ${resp.status})`);
  },

  async batchRestock(productIds, quantity, user = 'Batch Restock Process') {
    const resp = await fetch('/api/inventory/batch-restock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() },
      body: JSON.stringify({ product_ids: productIds, quantity: Number(quantity), user })
    });
    if (resp.ok) return await resp.json();
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to batch restock on server (HTTP ${resp.status})`);
  },

  // ----------------------------------------------------
  // AI Explainability & SHAP
  // ----------------------------------------------------

  async getShapGlobalFeatures() {
    await delay(100);
    try {
      const resp = await fetch('/api/ai-insights');
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data)) return data;
        console.warn('Unexpected SHAP global features response:', data);
      }
    } catch (e) {
      console.warn('SHAP global features request failed:', e.message);
    }
    return [...mockGlobalFeatureImportance];
  },

  async getShapProductDecomposition(productId, productObj = null) {
    await delay(100);
    try {
      const resp = await fetch(`/api/shap/${productId}`);
      if (resp.ok) {
        const data = await resp.json();
        const base = data.basePrice ?? data.base_value ?? 100;
        const finalP = data.finalPrice ?? data.final_recommended_price ?? base;
        const features = data.features || (data.waterfall_points || []).map(pt => ({
          name: pt.name,
          impact: pt.value,
          delta: pt.type === 'base' ? 0 : pt.value,
          type: pt.type === 'base' ? 'base' : pt.value >= 0 ? 'positive' : 'negative',
          reason: pt.description
        }));
        return {
          productName: data.productName || data.product_name,
          basePrice: base,
          finalPrice: finalP,
          features,
          naturalLanguageExplanation: data.naturalLanguageExplanation || `Pricing recommendation decomposed across decision drivers with base price ₹${base} to optimal target ₹${finalP}.`,
          explanation_method: data.explanation_method || 'deterministic_rule_attribution',
          is_genuine_shap: Boolean(data.is_genuine_shap),
          model_version: data.model_version || 'Deterministic Pricing Rule Attribution v1.0',
          r2_score: data.r2_score ?? null
        };
      }
    } catch (e) {
      // fallback
    }
    if (mockProductShapDecomposition[productId] && !productObj) {
      return mockProductShapDecomposition[productId];
    }

    const prod = productObj || mockProducts.find(p => p.id === productId || p.sku === productId) || mockProducts[0];
    if (!prod) return mockProductShapDecomposition['prod-001'];

    const price = Number(prod.currentPrice ?? prod.current_price ?? 100);
    const cost = Number(prod.cost ?? prod.baseCost ?? price * 0.5);
    const recPrice = Number(prod.recommendedPrice ?? (price * 1.08).toFixed(2));
    const compPrice = Number(prod.competitorPrice ?? prod.competitor_price ?? (price * 1.05).toFixed(2));
    const elasticity = Number(prod.elasticity ?? -1.25);
    const stock = Number(prod.stock ?? 0);
    const minStock = Number(prod.minimum_stock ?? prod.reorderLevel ?? 30);

    const compDiff = compPrice - price;
    const compImpact = Number((compDiff * 0.4).toFixed(2));
    const elastImpact = Number((Math.abs(elasticity) < 1.2 ? (price * 0.05) : -(price * 0.03)).toFixed(2));
    const stockDiff = stock - minStock;
    const stockImpact = Number((stock <= minStock ? (price * 0.04) : stockDiff > minStock * 2 ? -(price * 0.02) : 0).toFixed(2));

    const baseContribution = Number(price.toFixed(2));

    const features = [
      { name: "Base Model Baseline", impact: baseContribution, type: "base", delta: 0 },
      {
        name: `Competitor Price Benchmark (₹${compPrice})`,
        impact: compImpact,
        type: compImpact >= 0 ? "positive" : "negative",
        delta: compImpact,
        reason: compImpact >= 0
          ? `Competitor benchmark at ₹${compPrice} creates room for +₹${compImpact} pricing leverage.`
          : `Competitor at ₹${compPrice} exerts downward price pressure.`
      },
      {
        name: `Price Elasticity (ε = ${elasticity})`,
        impact: elastImpact,
        type: elastImpact >= 0 ? "positive" : "negative",
        delta: elastImpact,
        reason: Math.abs(elasticity) < 1.2
          ? `Inelastic customer demand supports margin expansion (+₹${elastImpact}).`
          : `Elastic market response requires competitive price calibration.`
      },
      {
        name: `Inventory Buffer (${stock} units on hand)`,
        impact: stockImpact,
        type: stockImpact >= 0 ? "positive" : "negative",
        delta: stockImpact,
        reason: stock <= minStock
          ? `Low stock reserves protect margins and slow run-rate depletion (+₹${stockImpact}).`
          : `Stock volume (${stock} units) maintains normal turnover pace.`
      }
    ];

    const naturalLanguageExplanation = `The AI pricing model evaluated ${prod.name} (SKU: ${prod.sku}) and determined an optimal target price of ₹${recPrice}. Key decision drivers include a competitor benchmark of ₹${compPrice}, elasticity responsiveness of ${elasticity}, and current warehouse inventory of ${stock} units (min threshold: ${minStock}).`;

    return {
      productName: prod.name,
      basePrice: baseContribution,
      finalPrice: recPrice,
      features,
      naturalLanguageExplanation
    };
  },

  // ----------------------------------------------------
  // Dashboard & Reports
  // ----------------------------------------------------
  async getDashboardSummary() {
    await delay(100);
    try {
      const resp = await fetch('/api/dashboard/summary');
      if (resp.ok) return await resp.json();
    } catch (e) {
      // fallback
    }
    return null;
  },

  async getReports() {
    await delay(100);
    try {
      const resp = await fetch('/api/reports/summary');
      if (resp.ok) return await resp.json();
    } catch (e) {
      // fallback
    }
    return { ...mockReportsData };
  },

  async getAlerts() {
    await delay(50);
    return [...mockAlerts];
  }
};
