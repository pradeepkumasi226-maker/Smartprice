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
        const token = session?.token;
        const expiry = session?.expires_at || session?.expiresAt;
        if (token && typeof token === 'string' && token.trim() && token !== 'null' && token !== 'undefined') {
          if (!expiry || expiry > Date.now()) {
            return { 'Authorization': `Bearer ${token.trim()}` };
          } else {
            localStorage.removeItem('smartprice_session');
            localStorage.removeItem('smartprice_user');
            localStorage.removeItem('smartprice_auth');
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('smartprice_auth_expired', { detail: { reason: 'Session expired' } }));
            }
          }
        }
      }
    } catch (e) {
      // ignore
    }
    return {};
  },

  handleAuthError(status, detail) {
    if (status === 401) {
      const lower = (detail || '').toLowerCase();
      if (lower.includes('token') || lower.includes('session') || lower.includes('unauthorized') || lower.includes('authentication required')) {
        try {
          localStorage.removeItem('smartprice_session');
          localStorage.removeItem('smartprice_user');
          localStorage.removeItem('smartprice_auth');
        } catch (e) {}
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('smartprice_auth_expired', { detail: { reason: detail } }));
        }
      }
    }
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

    const payload = { identifier: trimmedId, password };

    const resp = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (resp.ok) {
      const data = await resp.json();
      return {
        success: true,
        requires_otp: false,
        message: data.message || 'Login successful.',
        session: data.session,
        user: data.user
      };
    } else {
      const err = await resp.json().catch(() => ({}));
      let message = err.detail || 'Authentication failed. Please verify your credentials.';
      if (Array.isArray(err.detail)) {
        message = err.detail.map(d => d.msg || d.message).join(', ');
      }
      throw new Error(message);
    }
  },

  async verifyLoginOtp(verifyData = {}) {
    return this.login(verifyData);
  },

  async resendLoginOtp() {
    return { success: true, message: 'OTP verification is disabled; please log in with your password.' };
  },

  async sendRegisterOtp() {
    return { success: true, message: 'Direct registration is active.' };
  },

  async register(registrationData = {}) {
    const { name, email, password, confirmPassword } = registrationData;
    const cleanName = (name || '').trim();
    const cleanEmail = (email || '').trim();

    if (!cleanName) {
      throw new Error('Please enter your full name.');
    }
    if (!cleanEmail) {
      throw new Error('Please enter your email address.');
    }
    if (!password) {
      throw new Error('Password is required.');
    }
    if (confirmPassword !== undefined && password !== confirmPassword) {
      throw new Error('Passwords do not match.');
    }
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }

    const resp = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: cleanName,
        email: cleanEmail,
        password,
        confirm_password: confirmPassword
      })
    });

    if (resp.ok) {
      const data = await resp.json();
      return {
        success: true,
        message: data.message || 'Account created successfully!',
        session: data.session,
        user: data.user
      };
    } else {
      const err = await resp.json().catch(() => ({}));
      let message = err.detail || 'Registration failed. Please check your inputs.';
      if (Array.isArray(err.detail)) {
        message = err.detail.map(d => d.msg || d.message).join(', ');
      }
      throw new Error(message);
    }
  },

  async forgotPassword(identifier) {
    const cleanId = (identifier || '').trim();
    if (!cleanId) {
      throw new Error('Please enter your email or username.');
    }
    const resp = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: cleanId })
    });
    if (resp.ok) {
      return await resp.json();
    }
    const err = await resp.json().catch(() => ({}));
    let message = err.detail || 'Unable to request password reset.';
    if (Array.isArray(err.detail)) {
      message = err.detail.map(d => d.msg || d.message).join(', ');
    }
    throw new Error(message);
  },

  async sendForgotPasswordOtp(identifier) {
    return this.forgotPassword(identifier);
  },

  async resetPassword(tokenOrPayload, newPassword, confirmPassword) {
    let payload = {};
    if (typeof tokenOrPayload === 'object' && tokenOrPayload !== null) {
      payload = {
        token: (tokenOrPayload.token || tokenOrPayload.resetToken || '').trim(),
        new_password: tokenOrPayload.newPassword || tokenOrPayload.new_password,
        confirm_password: tokenOrPayload.confirmPassword || tokenOrPayload.confirm_password
      };
    } else {
      payload = {
        token: (tokenOrPayload || '').trim(),
        new_password: newPassword,
        confirm_password: confirmPassword
      };
    }

    if (!payload.token) {
      throw new Error('Password reset recovery token is required.');
    }
    if (!payload.new_password || payload.new_password.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }
    if (payload.confirm_password !== undefined && payload.new_password !== payload.confirm_password) {
      throw new Error('Passwords do not match.');
    }

    const resp = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (resp.ok) {
      return await resp.json();
    }
    const err = await resp.json().catch(() => ({}));
    let message = err.detail || 'Password reset failed.';
    if (Array.isArray(err.detail)) {
      message = err.detail.map(d => d.msg || d.message).join(', ');
    }
    throw new Error(message);
  },

  async changePassword(currentPassword, newPassword, confirmPassword) {
    if (!currentPassword) throw new Error('Current password is required.');
    if (!newPassword || newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long.');
    }
    if (newPassword !== confirmPassword) {
      throw new Error('New passwords do not match.');
    }
    const resp = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword
      })
    });
    if (resp.ok) {
      return await resp.json();
    }
    const err = await resp.json().catch(() => ({}));
    this.handleAuthError(resp.status, err.detail);
    throw new Error(err.detail || 'Failed to change password.');
  },

  async checkHealth() {
    try {
      const resp = await fetch('/api/health');
      return resp.ok;
    } catch (e) {
      return false;
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
  async getProducts(options = {}) {
    let url = '/api/products';
    if (options && options.min_margin_pct !== undefined) {
      url += `?min_margin_pct=${encodeURIComponent(options.min_margin_pct)}`;
    }
    const resp = await fetch(url);
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map(normalizeProduct);
      }
    }
    throw new Error(`Failed to fetch products from backend: HTTP ${resp.status}`);
  },

  async getProductById(id, options = {}) {
    let url = `/api/products/${encodeURIComponent(id)}`;
    if (options && options.min_margin_pct !== undefined) {
      url += `?min_margin_pct=${encodeURIComponent(options.min_margin_pct)}`;
    }
    const resp = await fetch(url);
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
    this.handleAuthError(resp.status, err.detail);
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
    this.handleAuthError(resp.status, err.detail);
    throw new Error(err.detail || `Failed to update product on backend (HTTP ${resp.status})`);
  },

  async deleteProduct(skuOrId) {
    const resp = await fetch(`/api/products/${encodeURIComponent(skuOrId)}`, {
      method: 'DELETE',
      headers: { ...this.getAuthHeaders() }
    });
    if (resp.ok) return await resp.json();
    const err = await resp.json().catch(() => ({}));
    this.handleAuthError(resp.status, err.detail);
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
    this.handleAuthError(resp.status, err.detail);
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
    this.handleAuthError(resp.status, err.detail);
    throw new Error(err.detail || `Failed to apply AI prices in batch (HTTP ${resp.status})`);
  },

  // ----------------------------------------------------
  // Sales & Revenue Trends
  // ----------------------------------------------------
  async getSales() {
    await delay(50);
    const resp = await fetch('/api/dashboard/sales');
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data)) return data;
    }
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch sales trends (HTTP ${resp.status})`);
  },

  async getRevenueTrends() {
    await delay(50);
    const resp = await fetch('/api/dashboard/sales');
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data)) return data;
    }
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch revenue trends (HTTP ${resp.status})`);
  },

  // ----------------------------------------------------
  // Demand Forecast
  // ----------------------------------------------------
  // ----------------------------------------------------
  // Demand Forecasting & Timeline
  // ----------------------------------------------------
  async getDemandForecast(timeRange = '7d', sku = null, category = null) {
    await delay(50);
    const params = new URLSearchParams();
    if (timeRange) params.append('time_range', timeRange);
    if (sku && sku !== 'All') params.append('sku', sku);
    if (category && category !== 'All') params.append('category', category);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const resp = await fetch(`/api/forecast${queryString}`);
    if (resp.ok) {
      const data = await resp.json();
      if (data && Array.isArray(data.points)) {
        return data;
      }
    }
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch demand forecast from server (HTTP ${resp.status})`);
  },

  async getProductForecasts(timeRange = '7d', category = null) {
    await delay(50);
    const params = new URLSearchParams();
    if (timeRange) params.append('time_range', timeRange);
    if (category && category !== 'All') params.append('category', category);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const resp = await fetch(`/api/forecast/products${queryString}`);
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data)) {
        return data;
      }
    }
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch product forecasts from server (HTTP ${resp.status})`);
  },

  async getSeasonalityDrivers() {
    await delay(50);
    const resp = await fetch('/api/forecast/seasonality');
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data)) {
        return data;
      }
    }
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch seasonality drivers from server (HTTP ${resp.status})`);
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

    const resp = await fetch(`/api/pricing/recommendations${queryString}`);
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data)) {
        return data.map(normalizeOptimization);
      }
    }
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch pricing recommendations (HTTP ${resp.status})`);
  },

  async generateRecommendations(guardrails = {}) {
    await delay(100);
    const resp = await fetch('/api/pricing/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() },
      body: JSON.stringify(guardrails)
    });
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data)) {
        return data.map(normalizeOptimization);
      }
    }
    const err = await resp.json().catch(() => ({}));
    this.handleAuthError(resp.status, err.detail);
    throw new Error(err.detail || `Failed to generate pricing recommendations (HTTP ${resp.status})`);
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

  async getElasticityCurve(skuOrId, productObj = null) {
    await delay(50);
    const sku = productObj?.sku || skuOrId;
    const resp = await fetch(`/api/pricing/${encodeURIComponent(sku)}/elasticity`);
    if (resp.ok) {
      const data = await resp.json();
      if (data && Array.isArray(data.points)) {
        return data.points;
      }
    }
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch elasticity curve for ${sku} (HTTP ${resp.status})`);
  },

  // ----------------------------------------------------
  // What-If Dynamic Pricing Simulation
  // ----------------------------------------------------
  async simulateWhatIf(skuOrId, simulatedPrice, extraOptions = {}) {
    await delay(50);
    const payload = {
      sku: extraOptions.sku || (typeof skuOrId === 'string' && skuOrId.includes('-') && !skuOrId.startsWith('prod-') ? skuOrId : undefined),
      product_id: extraOptions.productId || extraOptions.product_id || (typeof skuOrId === 'string' && skuOrId.startsWith('prod-') ? skuOrId : undefined),
      simulated_price: Number(simulatedPrice),
      competitor_offset: Number(extraOptions.competitorOffset || 0.0),
      elasticity_multiplier: Number(extraOptions.elasticityMultiplier || 1.0),
      promo_discount: Number(extraOptions.promoDiscount || 0.0)
    };
    if (!payload.sku && !payload.product_id) {
      payload.sku = skuOrId;
    }

    const resp = await fetch('/api/what-if/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.getAuthHeaders() },
      body: JSON.stringify(payload)
    });
    if (resp.ok) {
      const data = await resp.json();
      return {
        product: extraOptions.product || { id: data.product_id, sku: data.sku, name: data.product_name },
        simulatedPrice: data.simulated_price,
        baselinePrice: data.baseline_price,
        simulatedDemand: data.simulated_demand,
        baselineDemand: data.baseline_demand,
        demandDelta: data.demand_delta,
        demandPercentDelta: String(data.demand_percent_delta),
        simulatedRevenue: data.simulated_revenue,
        baselineRevenue: data.baseline_revenue,
        revenueDelta: data.revenue_delta,
        revenuePercentDelta: data.revenue_percent_delta,
        simulatedProfit: data.simulated_profit,
        baselineProfit: data.baseline_profit,
        profitDelta: data.profit_delta,
        profitPercentDelta: data.baseline_profit > 0 ? Number(((data.profit_delta / data.baseline_profit) * 100).toFixed(1)) : 0,
        marginPercent: data.simulated_margin,
        baselineMargin: data.baseline_margin,
        competitorPrice: data.competitor_price,
        isPriceHigherThanCompetitor: data.is_price_higher_than_competitor
      };
    }
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Simulation failed on backend (HTTP ${resp.status})`);
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
    await delay(50);
    const resp = await fetch('/api/ai-insights');
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data)) return data;
    }
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch AI insights from server (HTTP ${resp.status})`);
  },

  async getShapProductDecomposition(skuOrId, productObj = null) {
    await delay(50);
    const sku = productObj?.sku || skuOrId;
    const resp = await fetch(`/api/shap/${encodeURIComponent(sku)}`);
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
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to load SHAP decomposition for ${sku} (HTTP ${resp.status})`);
  },

  // ----------------------------------------------------
  // Dashboard & Reports
  // ----------------------------------------------------
  async getDashboardSummary() {
    await delay(50);
    const resp = await fetch('/api/dashboard/summary');
    if (resp.ok) return await resp.json();
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch dashboard summary (HTTP ${resp.status})`);
  },

  async getReports() {
    await delay(50);
    const resp = await fetch('/api/reports/summary');
    if (resp.ok) return await resp.json();
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch reports summary (HTTP ${resp.status})`);
  },

  async getAlerts() {
    await delay(50);
    const resp = await fetch('/api/dashboard/insights');
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data)) return data;
    }
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch live alerts from server (HTTP ${resp.status})`);
  }
};

// Explicit exports of mock datasets for development/demo mode
export {
  mockProducts,
  mockSales,
  mockInventory,
  mockInventorySummary,
  mockRevenueTrends,
  mockDemandTimeline,
  mockSeasonalityDrivers,
  mockOptimizations,
  mockElasticityCurves,
  mockGlobalFeatureImportance,
  mockProductShapDecomposition,
  mockReportsData,
  mockAlerts
};
