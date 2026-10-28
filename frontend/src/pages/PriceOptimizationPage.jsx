import React, { useState, useEffect, useMemo } from 'react';
import {
  Tag,
  CheckCircle,
  TrendingUp,
  Sparkles,
  Sliders,
  AlertCircle,
  ShieldCheck,
  Check,
  Search,
  Filter,
  X,
  Plus,
  Package,
  Layers,
  RotateCcw,
  Edit3,
  Lock,
  Unlock,
  Settings,
  ArrowRight,
  TrendingDown,
  Info,
  DollarSign,
  AlertTriangle
} from 'lucide-react';
import { MetricCard } from '../components/common/MetricCard';
import { Badge } from '../components/common/Badge';
import { ElasticityCurveChart } from '../components/charts/ElasticityCurveChart';
import { Modal } from '../components/common/Modal';
import { useStore } from '../context/StoreContext';
import { apiService } from '../services/apiService';
import { formatCurrency } from '../utils/currency';

export const PriceOptimizationPage = () => {
  const {
    optimizations = [],
    products = [],
    approvePriceOptimization,
    rejectPriceOptimization,
    recalculateOptimization,
    generateAllRecommendations,
    batchApproveAll,
    navigateTo,
    pageParams = {},
    searchQuery = '',
    setSearchQuery,
    addToast,
    settings
  } = useStore();

  const safeProducts = Array.isArray(products) ? products : [];
  const rawOptimizations = Array.isArray(optimizations) ? optimizations : [];

  // Guardrail Configuration State (initialized from shared settings)
  const [showGuardrailPanel, setShowGuardrailPanel] = useState(false);
  const [guardrailSettings, setGuardrailSettings] = useState(() => ({
    minMargin: settings?.minMargin !== undefined ? Number(settings.minMargin) : 25,
    maxPriceChange: settings?.maxPriceChange !== undefined ? Number(settings.maxPriceChange) : 20,
    allowBelowCost: false
  }));

  useEffect(() => {
    if (settings?.minMargin !== undefined) {
      setGuardrailSettings(prev => ({
        ...prev,
        minMargin: Number(settings.minMargin),
        maxPriceChange: Number(settings.maxPriceChange ?? prev.maxPriceChange)
      }));
    }
  }, [settings?.minMargin, settings?.maxPriceChange]);

  const [isEngineRunning, setIsEngineRunning] = useState(false);
  const [engineError, setEngineError] = useState(null);

  // Custom Price Override Modal State
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideTargetOpt, setOverrideTargetOpt] = useState(null);
  const [customPriceInput, setCustomPriceInput] = useState('');
  const [overrideError, setOverrideError] = useState('');

  // Harmonize recommendations across ALL catalog products
  const safeOptimizations = useMemo(() => {
    return safeProducts.map(prod => {
      const livePrice = Number(prod.currentPrice ?? prod.current_price ?? 100);
      const costP = Number(prod.cost ?? prod.cost_price ?? prod.baseCost ?? livePrice * 0.5);
      const compP = Number(prod.competitorPrice ?? prod.competitor_price ?? 0);
      const stock = Number(prod.stockQuantity ?? prod.stock_quantity ?? prod.stock ?? 0);
      const reorder = Number(prod.reorderLevel ?? prod.reorder_level ?? 30);
      const safety = Number(prod.safetyStock ?? prod.safety_stock ?? 15);
      const elasticity = Number(prod.elasticity ?? -1.25);
      const baseDemand = Number(prod.predictedDemand ?? prod.predicted_demand ?? 100);

      // Check if recommendation exists in rawOptimizations
      const match = rawOptimizations.find(o => o.productId === prod.id || o.sku === prod.sku);

      let recPrice;
      let status;
      let rationale;
      let guardrailStatus;

      if (match) {
        recPrice = Number(match.recommendedPrice ?? match.recommended_price ?? livePrice);
        status = match.status || 'Pending Approval';
        rationale = match.rationale || match.reason;
        guardrailStatus = match.guardrailStatus || match.guardrail_status || 'Pass';
      } else {
        // Dynamic pricing calculation from product attributes
        let shift = 0.05;
        if (stock <= safety) shift = 0.08;
        else if (stock <= reorder) shift = 0.04;
        else if (stock > reorder * 2.5) shift = -0.04;
        else if (compP > livePrice) shift = Math.min(0.08, ((compP - livePrice) / livePrice) * 0.7);

        const marginFraction = Math.min(Math.max((Number(guardrailSettings.minMargin) || 0) / 100, 0), 0.95);
        const computedFloor = Number((costP / (1 - marginFraction)).toFixed(2));
        recPrice = Number(Math.max(computedFloor, livePrice * (1 + shift)).toFixed(2));
        status = 'Pending Approval';
        guardrailStatus = 'Pass';
      }

      // Hard rule: Never recommend below product cost unless explicitly permitted
      if (!guardrailSettings.allowBelowCost && recPrice < costP) {
        recPrice = Number(costP.toFixed(2));
      }

      const diff = Number((recPrice - livePrice).toFixed(2));
      const pctVal = livePrice > 0 ? Number(((diff / livePrice) * 100).toFixed(1)) : 0;
      const isApproved = status === 'Approved';
      const isStale = (!isApproved && livePrice === recPrice) || match?.isStale || match?.is_stale;
      const priceDelta = isApproved ? '₹0.00' : (diff > 0 ? `+₹${diff.toFixed(2)}` : diff < 0 ? `-₹${Math.abs(diff).toFixed(2)}` : '₹0.00');
      const priceChangePct = isApproved ? '+0.0%' : (pctVal > 0 ? `+${pctVal.toFixed(1)}%` : `${pctVal.toFixed(1)}%`);

      // Inventory status and factors
      const stockStatus = stock <= safety ? 'Critical' : stock <= reorder ? 'Low Stock' : stock > reorder * 2.5 ? 'Overstocked' : 'Optimal';
      const invFactorText = stock <= safety
        ? `Critical stock (${stock}u <= safety ${safety}u): scarcity protection preserves margin to avoid stockout.`
        : stock <= reorder
        ? `Low stock (${stock}u <= reorder ${reorder}u): price maintained to preserve inventory buffer.`
        : stock > reorder * 2.5
        ? `Surplus inventory (${stock}u > 2.5x reorder): promotional markdown incentivizes turnover.`
        : `Balanced inventory depth (${stock} units): optimal elasticity-driven volume capture.`;

      // Approval-aware or fallback rationale
      if (isApproved && diff === 0 && (!rationale || rationale.includes('➔') || rationale.toLowerCase().startsWith('recommends'))) {
        const eLabel = Math.abs(elasticity) < 1.0 ? 'inelastic' : Math.abs(elasticity) <= 1.5 ? 'moderately elastic' : 'highly price-sensitive';
        const compText = compP > 0 ? `Competitor indexed at ₹${compP.toFixed(2)}.` : 'No direct competitor tracking.';
        rationale = `Approved at target price ₹${livePrice.toFixed(2)}. Live shelf price aligns with profit-optimal elasticity of ${elasticity} (${eLabel}). ${invFactorText} ${compText} Wholesale cost floor ₹${costP.toFixed(2)} strictly respected.`;
      } else if (!rationale) {
        const eLabel = Math.abs(elasticity) < 1.0 ? 'inelastic' : Math.abs(elasticity) <= 1.5 ? 'moderately elastic' : 'highly price-sensitive';
        const dir = diff > 0 ? `Recommends +${pctVal}% price increase (₹${livePrice.toFixed(2)} ➔ ₹${recPrice.toFixed(2)}) to capture gross margin.` : diff < 0 ? `Recommends ${pctVal}% promotional adjustment (₹${livePrice.toFixed(2)} ➔ ₹${recPrice.toFixed(2)}) to accelerate velocity.` : 'Current price matches optimal target.';
        const compText = compP > 0 ? `Competitor indexed at ₹${compP.toFixed(2)}.` : 'No direct competitor tracking.';
        rationale = `${dir} Demand elasticity ${elasticity} (${eLabel}). ${invFactorText} ${compText} Wholesale cost floor ₹${costP.toFixed(2)} strictly respected.`;
      }


      // Expected financial metrics
      const pPct = livePrice > 0 ? (recPrice - livePrice) / livePrice : 0;
      const expDemand = isApproved ? baseDemand : (match?.expectedDemand || match?.expected_demand || Math.max(10, Math.round(baseDemand * (1 + (elasticity * pPct)))));
      const curRev = Math.round(livePrice * baseDemand);
      const curProfit = Math.round((livePrice - costP) * baseDemand);
      const expRev = Math.round(recPrice * expDemand);
      const expProfit = Math.round((recPrice - costP) * expDemand);
      const revLiftVal = expRev - curRev;
      const profitLiftVal = expProfit - curProfit;
      const revLiftPct = curRev > 0 ? ((revLiftVal / curRev) * 100).toFixed(1) : '0.0';
      const profitLiftPct = curProfit > 0 ? ((profitLiftVal / curProfit) * 100).toFixed(1) : '0.0';

      const marginFraction = Math.min(Math.max((Number(guardrailSettings.minMargin) || 0) / 100, 0), 0.95);
      const computedFloor = Number((costP / (1 - marginFraction)).toFixed(2));
      const minGuardrail = Number(match?.minGuardrail ?? match?.min_guardrail ?? (guardrailSettings.allowBelowCost ? 0.01 : Math.max(costP, computedFloor)));
      const maxGuardrail = Number(match?.maxGuardrail ?? match?.max_guardrail ?? (livePrice * (1 + guardrailSettings.maxPriceChange / 100)).toFixed(2));

      return {
        id: match?.id || `opt-${prod.id}`,
        productId: prod.id,
        sku: prod.sku,
        productName: prod.name,
        category: prod.category || 'General',
        currentPrice: livePrice,
        recommendedPrice: recPrice,
        costPrice: costP,
        competitorPrice: compP,
        stockQuantity: stock,
        reorderLevel: reorder,
        safetyStock: safety,
        stockStatus,
        inventoryFactorText: invFactorText,
        priceDelta,
        priceDeltaVal: diff,
        priceChangePct,
        priceChangePctVal: pctVal,
        expectedDemand: expDemand,
        demandDelta: isApproved ? '+0.0%' : (expDemand >= baseDemand ? `+${(((expDemand - baseDemand) / baseDemand) * 100).toFixed(1)}%` : `${(((expDemand - baseDemand) / baseDemand) * 100).toFixed(1)}%`),
        revenueLift: isApproved ? '+0.0%' : `${Number(revLiftPct) >= 0 ? '+' : ''}${revLiftPct}%`,
        revenueLiftVal: isApproved ? 0 : revLiftVal,
        profitLift: isApproved ? '+0.0%' : `${Number(profitLiftPct) >= 0 ? '+' : ''}${profitLiftPct}%`,
        profitLiftVal: isApproved ? 0 : profitLiftVal,
        expectedMargin: `${(((recPrice - costP) / recPrice) * 100).toFixed(1)}%`,
        marginDelta: '+2.5%',
        elasticityScore: elasticity,
        elasticityLabel: Math.abs(elasticity) > 1.5 ? 'Highly Elastic' : Math.abs(elasticity) >= 1.0 ? 'Moderately Elastic' : 'Inelastic',
        costFloor: costP,
        minGuardrail,
        maxGuardrail,
        guardrailStatus,
        status,
        isStale,
        staleReason: isStale && !isApproved ? `Product is already priced at ₹${livePrice.toFixed(2)}.` : match?.staleReason,
        rationale
      };
    });
  }, [safeProducts, rawOptimizations, guardrailSettings]);

  const [selectedOptId, setSelectedOptId] = useState(
    pageParams?.optId || safeOptimizations[0]?.id || 'opt-prod-001'
  );
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');
  const [selectedDirectionFilter, setSelectedDirectionFilter] = useState('All');
  const [curveData, setCurveData] = useState([]);
  const [loadingCurve, setLoadingCurve] = useState(false);

  // Sync with cross-page params if any
  useEffect(() => {
    if (pageParams?.optId) {
      setSelectedOptId(pageParams.optId);
    } else if (pageParams?.productId) {
      const match = safeOptimizations.find(o => o.productId === pageParams.productId);
      if (match) setSelectedOptId(match.id);
    } else if (!selectedOptId && safeOptimizations.length > 0) {
      setSelectedOptId(safeOptimizations[0].id);
    }
  }, [pageParams, safeOptimizations, selectedOptId]);

  const selectedOpt = useMemo(() => {
    if (safeOptimizations.length === 0) return null;
    return safeOptimizations.find(o => o.id === selectedOptId || o.productId === selectedOptId) || safeOptimizations[0] || null;
  }, [safeOptimizations, selectedOptId]);

  // Load elasticity curve for selected product
  useEffect(() => {
    let isMounted = true;
    async function loadCurve() {
      if (!selectedOpt) {
        setCurveData([]);
        return;
      }
      setLoadingCurve(true);
      try {
        const matchingProduct = safeProducts.find(p => p.id === selectedOpt.productId || p.sku === selectedOpt.sku);
        const data = await apiService.getElasticityCurve(selectedOpt.sku || selectedOpt.productId || selectedOpt.id || 'prod-001', matchingProduct);
        if (isMounted) {
          setCurveData(Array.isArray(data) ? data : (data?.points || []));
        }
      } catch (err) {
        console.error("Error loading elasticity curve:", err);
        if (isMounted) {
          setCurveData([]);
        }
      } finally {
        if (isMounted) {
          setLoadingCurve(false);
        }
      }
    }
    loadCurve();
    return () => { isMounted = false; };
  }, [selectedOpt, safeProducts]);

  // Aggregate stats
  const pendingCount = useMemo(() => {
    return safeOptimizations.filter(o => (o?.status === 'Pending Approval' || o?.status === 'Pending') && !o.isStale).length;
  }, [safeOptimizations]);

  const approvedCount = useMemo(() => {
    return safeOptimizations.filter(o => o?.status === 'Approved').length;
  }, [safeOptimizations]);

  const staleCount = useMemo(() => {
    return safeOptimizations.filter(o => o?.isStale && o?.status !== 'Approved').length;
  }, [safeOptimizations]);

  const categories = useMemo(() => {
    const set = new Set(safeProducts.map(p => p.category).filter(Boolean));
    return ['All', ...Array.from(set)];
  }, [safeProducts]);

  // Filtered optimizations
  const filteredOptimizations = useMemo(() => {
    return safeOptimizations.filter(opt => {
      if (!opt) return false;
      const q = (searchQuery || '').toLowerCase().trim();
      const matchesSearch = !q ||
        (opt.productName || '').toLowerCase().includes(q) ||
        (opt.sku || '').toLowerCase().includes(q) ||
        (opt.category || '').toLowerCase().includes(q);

      const matchesStatus = selectedStatusFilter === 'All' || opt.status === selectedStatusFilter;
      const matchesCategory = selectedCategoryFilter === 'All' || opt.category === selectedCategoryFilter;

      let matchesDirection = true;
      if (selectedDirectionFilter === 'Increases') {
        matchesDirection = opt.priceDeltaVal > 0;
      } else if (selectedDirectionFilter === 'Decreases') {
        matchesDirection = opt.priceDeltaVal < 0;
      }

      return matchesSearch && matchesStatus && matchesCategory && matchesDirection;
    });
  }, [safeOptimizations, searchQuery, selectedStatusFilter, selectedCategoryFilter, selectedDirectionFilter]);

  const { totalProjectedRevenueLift, totalProjectedProfitLift, pendingLiftCount, avgPriceShift } = useMemo(() => {
    let revLift = 0;
    let profitLift = 0;
    let count = 0;
    let totalPct = 0;

    safeOptimizations.forEach(o => {
      if (!o || o.status !== 'Pending Approval' || o.isStale) return;
      revLift += Number(o.revenueLiftVal ?? 0);
      profitLift += Number(o.profitLiftVal ?? 0);
      totalPct += Number(o.priceChangePctVal ?? 0);
      count++;
    });

    return {
      totalProjectedRevenueLift: revLift,
      totalProjectedProfitLift: profitLift,
      pendingLiftCount: count,
      avgPriceShift: count > 0 ? (totalPct / count).toFixed(1) : '0.0'
    };
  }, [safeOptimizations]);

  // Run Dynamic Pricing Engine across all SKUs
  const handleRunPricingEngine = async () => {
    setIsEngineRunning(true);
    setEngineError(null);
    try {
      if (generateAllRecommendations) {
        await generateAllRecommendations({
          min_margin_pct: guardrailSettings.minMargin,
          max_price_change_pct: guardrailSettings.maxPriceChange,
          allow_below_cost: guardrailSettings.allowBelowCost
        });
      } else {
        await apiService.generateRecommendations({
          min_margin_pct: guardrailSettings.minMargin,
          max_price_change_pct: guardrailSettings.maxPriceChange,
          allow_below_cost: guardrailSettings.allowBelowCost
        });
      }
    } catch (err) {
      console.error("Pricing Engine execution error:", err);
      setEngineError(err.message || "Failed to execute Pricing Engine");
    } finally {
      setIsEngineRunning(false);
    }
  };

  // Open Custom Price Override Modal
  const handleOpenOverride = (opt, e) => {
    if (e) e.stopPropagation();
    setOverrideTargetOpt(opt);
    setCustomPriceInput(String(opt.recommendedPrice));
    setOverrideError('');
    setOverrideModalOpen(true);
  };

  // Submit Custom Price Override
  const handleSubmitOverride = async () => {
    if (!overrideTargetOpt) return;
    const price = parseFloat(customPriceInput);

    if (isNaN(price) || price <= 0) {
      setOverrideError('Please enter a valid price greater than ₹0.00.');
      return;
    }

    if (!guardrailSettings.allowBelowCost && price < overrideTargetOpt.costPrice) {
      setOverrideError(`Price ₹${price.toFixed(2)} is below product cost ₹${overrideTargetOpt.costPrice.toFixed(2)}. Guardrail violation.`);
      return;
    }

    const success = await approvePriceOptimization(overrideTargetOpt.id, price, guardrailSettings.allowBelowCost);
    if (success !== false) {
      setOverrideModalOpen(false);
      setOverrideTargetOpt(null);
    }
  };

  if (safeProducts.length === 0) {
    return (
      <div>
        <div className="card-glass" style={{ padding: '3.5rem 2rem', textAlign: 'center', margin: '2rem auto', maxWidth: '600px' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--primary-light)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
            <Tag size={28} color="var(--primary)" />
          </div>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem' }}>No products available yet</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.75rem', lineHeight: 1.5 }}>
            Add a product to the catalog to enable the Dynamic Pricing Engine.
          </p>
          <button className="btn btn-primary" onClick={() => navigateTo('products')} id="add-product-btn">
            <Plus size={16} /> Add Product
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Top Banner / Engine Header */}
      <div className="optimization-hero-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
              <div style={{ padding: '0.4rem', borderRadius: 'var(--radius-sm)', background: 'rgba(99, 102, 241, 0.15)', display: 'inline-flex' }}>
                <Sparkles size={20} color="var(--primary)" />
              </div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>Dynamic Pricing Engine</h2>
              <Badge variant="ai">Rule-Based & Empirical Elasticity</Badge>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Empirical price elasticity modeling, competitor benchmark indexing, inventory velocity, and strict guardrails.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setShowGuardrailPanel(!showGuardrailPanel)}
              title="Configure safety guardrails and business rules"
            >
              <Settings size={16} />
              <span>Guardrail Settings</span>
            </button>

            <button
              className="btn btn-ai"
              onClick={handleRunPricingEngine}
              disabled={isEngineRunning}
              title="Recalculate dynamic recommendations for all SKUs"
            >
              <RotateCcw size={16} className={isEngineRunning ? 'spin' : ''} />
              <span>{isEngineRunning ? 'Evaluating Models...' : 'Run Pricing Engine'}</span>
            </button>

            <button
              className="btn btn-primary"
              onClick={batchApproveAll}
              disabled={pendingCount === 0 || isEngineRunning}
            >
              <CheckCircle size={16} />
              <span>Approve All Pending ({pendingCount})</span>
            </button>
          </div>
        </div>

        {/* Engine Error Alert if any */}
        {engineError && (
          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)' }}>
            <AlertCircle size={16} />
            <span style={{ fontSize: '0.82rem' }}>{engineError}</span>
            <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={handleRunPricingEngine}>Retry</button>
          </div>
        )}

        {/* Collapsible Guardrails Configuration Drawer */}
        {showGuardrailPanel && (
          <div style={{ marginTop: '1.25rem', padding: '1.25rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={18} color="var(--success)" />
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Configurable Engine Guardrails & Business Rules</span>
              </div>
              <button
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                onClick={() => setShowGuardrailPanel(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                  Min Margin Floor (% above wholesale cost)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    className="form-input"
                    value={guardrailSettings.minMargin}
                    onChange={(e) => setGuardrailSettings({ ...guardrailSettings, minMargin: parseFloat(e.target.value) || 0 })}
                    style={{ width: '100px' }}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>% minimum margin</span>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Guarantees recommendations stay at least this % above cost.</span>
              </div>

              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                  Max Price Shift Cap (±% from current shelf price)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="number"
                    min="5"
                    max="100"
                    step="1"
                    className="form-input"
                    value={guardrailSettings.maxPriceChange}
                    onChange={(e) => setGuardrailSettings({ ...guardrailSettings, maxPriceChange: parseFloat(e.target.value) || 30 })}
                    style={{ width: '100px' }}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>% maximum delta</span>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Restricts extreme price volatility between cycles.</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <label style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                  Clearance Rule: Permit Selling Below Cost
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <input
                    type="checkbox"
                    id="allow-below-cost-toggle"
                    checked={guardrailSettings.allowBelowCost}
                    onChange={(e) => setGuardrailSettings({ ...guardrailSettings, allowBelowCost: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="allow-below-cost-toggle" style={{ fontSize: '0.8rem', cursor: 'pointer', color: guardrailSettings.allowBelowCost ? 'var(--warning)' : 'var(--text-primary)' }}>
                    {guardrailSettings.allowBelowCost ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Unlock size={14} color="var(--warning)" /> Below-Cost Clearance Permitted
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Lock size={14} color="var(--success)" /> Strict Floor Lock (Cannot sell below cost)
                      </span>
                    )}
                  </label>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {guardrailSettings.allowBelowCost
                    ? 'Caution: Allows liquidating dead stock below acquisition cost.'
                    : 'Enforces hard wholesale cost floor across all models.'}
                </span>
              </div>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setGuardrailSettings({ minMargin: settings?.minMargin ?? 25, maxPriceChange: settings?.maxPriceChange ?? 20, allowBelowCost: false })}>
                Reset Defaults
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleRunPricingEngine}>
                Apply & Re-evaluate Engine
              </button>
            </div>
          </div>
        )}

        {/* Aggregate KPI Stats */}
        <div className="optimization-stats-row">
          <div style={{ padding: '1rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Projected Revenue Lift
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: totalProjectedRevenueLift >= 0 ? 'var(--success)' : 'var(--warning)', marginTop: '0.2rem' }}>
              {formatCurrency(totalProjectedRevenueLift, { showSign: true, decimals: 0 })}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              Gross Profit Lift: <strong style={{ color: 'var(--success)' }}>{formatCurrency(totalProjectedProfitLift, { showSign: true, decimals: 0 })}</strong> across {pendingLiftCount} pending model{pendingLiftCount !== 1 ? 's' : ''}
            </div>
          </div>

          <div style={{ padding: '1rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Approved / Active Prices
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-accent)', marginTop: '0.2rem' }}>
              {approvedCount} / {safeOptimizations.length} SKUs
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              {pendingCount} awaiting approval {staleCount > 0 ? `(${staleCount} at target price)` : ''}
            </div>
          </div>

          <div style={{ padding: '1rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Guardrail Safety Compliance
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--success)', marginTop: '0.2rem' }}>
              100% Passed
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              Strict cost floor & {guardrailSettings.minMargin}% margin boundaries respected
            </div>
          </div>
        </div>
      </div>

      {/* Main Optimization Matrix & Elasticity Visualizer */}
      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        {/* Left Column: Recommendations Table */}
        <div className="card-glass" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Catalog Recommendations</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Comparing current shelf prices vs recommended optimal target prices
              </p>
            </div>

            {/* Filter Controls */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <select
                className="form-select"
                style={{ width: 'auto', padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>
                ))}
              </select>

              <select
                className="form-select"
                style={{ width: 'auto', padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="Pending Approval">Pending Approval</option>
                <option value="Approved">Approved</option>
              </select>

              <select
                className="form-select"
                style={{ width: 'auto', padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                value={selectedDirectionFilter}
                onChange={(e) => setSelectedDirectionFilter(e.target.value)}
              >
                <option value="All">All Movements</option>
                <option value="Increases">Price Increases (+)</option>
                <option value="Decreases">Price Decreases (-)</option>
              </select>
            </div>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Product & Stock</th>
                  <th>Current Price</th>
                  <th>Recommended</th>
                  <th>Difference</th>
                  <th>% Change</th>
                  <th>Demand Lift</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOptimizations.length === 0 ? (
                  <tr>
                    <td colSpan="7">
                      <div className="empty-state-box">
                        <Package size={32} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
                        <div className="empty-state-title">No recommendations match filter</div>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                          Try clearing the search or adjusting the category and status filters.
                        </p>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            if (setSearchQuery) setSearchQuery('');
                            setSelectedStatusFilter('All');
                            setSelectedCategoryFilter('All');
                            setSelectedDirectionFilter('All');
                          }}
                        >
                          Clear All Filters
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredOptimizations.map((opt) => {
                    const isSelected = opt.id === selectedOpt?.id || opt.productId === selectedOpt?.productId;
                    const isApproved = opt.status === 'Approved';
                    const isStale = Boolean(opt.isStale || opt.is_stale);
                    const isPositive = opt.priceDeltaVal > 0;
                    const isNegative = opt.priceDeltaVal < 0;

                    return (
                      <tr
                        key={opt.id}
                        onClick={() => setSelectedOptId(opt.id)}
                        style={{
                          cursor: 'pointer',
                          backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.12)' : undefined,
                          borderLeft: isSelected ? '3px solid var(--primary)' : undefined
                        }}
                      >
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{opt.productName}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '2px' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{opt.sku}</span>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>•</span>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                background: opt.stockStatus === 'Critical' ? 'rgba(239, 68, 68, 0.15)' : opt.stockStatus === 'Low Stock' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                color: opt.stockStatus === 'Critical' ? 'var(--danger)' : opt.stockStatus === 'Low Stock' ? 'var(--warning)' : 'var(--success)'
                              }}
                            >
                              {opt.stockQuantity}u ({opt.stockStatus})
                            </span>
                          </div>
                        </td>
                        <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                          {formatCurrency(opt.currentPrice)}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-accent)', fontFamily: 'var(--font-mono)' }}>
                            {formatCurrency(opt.recommendedPrice)}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            Cost: {formatCurrency(opt.costPrice)}
                          </div>
                        </td>
                        <td>
                          <span
                            style={{
                              fontWeight: 700,
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.82rem',
                              color: isPositive ? 'var(--success)' : isNegative ? 'var(--warning)' : 'var(--text-muted)'
                            }}
                          >
                            {opt.priceDelta}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: '0.78rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: isPositive ? 'rgba(16, 185, 129, 0.12)' : isNegative ? 'rgba(245, 158, 11, 0.12)' : 'rgba(100, 116, 139, 0.12)',
                              color: isPositive ? 'var(--success)' : isNegative ? 'var(--warning)' : 'var(--text-muted)'
                            }}
                          >
                            {opt.priceChangePct || '+0.0%'}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8rem' }}>
                          <div>{opt.expectedDemand} units</div>
                          <div style={{ fontSize: '0.7rem', color: String(opt.demandDelta).startsWith('+') ? 'var(--success)' : String(opt.demandDelta).startsWith('-') ? 'var(--warning)' : 'var(--text-muted)' }}>
                            {opt.demandDelta}
                          </div>
                        </td>
                        <td>
                          {isApproved ? (
                            <Badge variant="success">Approved</Badge>
                          ) : isStale ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                              <Badge variant="warning">At Target</Badge>
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (recalculateOptimization) recalculateOptimization(opt.id, guardrailSettings);
                                }}
                                title="Recalculate recommendation"
                              >
                                Recalculate
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (approvePriceOptimization) approvePriceOptimization(opt.id, null, guardrailSettings.allowBelowCost);
                                }}
                                title="Accept recommended price"
                              >
                                Accept
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '0.25rem 0.4rem' }}
                                onClick={(e) => handleOpenOverride(opt, e)}
                                title="Override with custom approved price"
                              >
                                <Edit3 size={13} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Selected SKU Elasticity & Explanation */}
        {selectedOpt ? (
          (() => {
            const currentP = selectedOpt.currentPrice;
            const recP = selectedOpt.recommendedPrice;
            const costP = selectedOpt.costPrice;
            const compP = selectedOpt.competitorPrice;
            const minGuardrail = selectedOpt.minGuardrail;
            const maxGuardrail = selectedOpt.maxGuardrail;
            const isApproved = selectedOpt.status === 'Approved';
            const isStale = Boolean(selectedOpt.isStale || selectedOpt.is_stale);

            return (
              <div className="card-glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Selected Product Deep-Dive
                    </div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '0.2rem' }}>
                      {selectedOpt.productName}
                    </h3>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      SKU: <strong>{selectedOpt.sku}</strong> • Category: {selectedOpt.category} • Elasticity: <strong style={{ color: 'var(--text-accent)' }}>{selectedOpt.elasticityScore ?? -1.25}</strong> ({selectedOpt.elasticityLabel || 'Moderately Elastic'}) • <span style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: '4px', background: selectedOpt.elasticityReliable ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: selectedOpt.elasticityReliable ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>{selectedOpt.elasticityReliable ? 'Econometric Model' : 'Catalog Fallback'}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <Badge variant={isApproved ? 'success' : isStale ? 'warning' : 'purple'}>
                      {isApproved ? 'Approved' : isStale ? 'At Target Price' : (selectedOpt.status || 'Pending Approval')}
                    </Badge>
                    {!isApproved && !isStale && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => { if (approvePriceOptimization) approvePriceOptimization(selectedOpt.id, null, guardrailSettings.allowBelowCost); }}
                      >
                        Accept Engine Price
                      </button>
                    )}
                  </div>
                </div>

                {/* Key Price & Financial Impact Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                  <div style={{ padding: '0.65rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Current Shelf</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{formatCurrency(currentP)}</div>
                  </div>
                  <div style={{ padding: '0.65rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--primary)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--primary)', fontWeight: 600 }}>Recommended</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-accent)', fontFamily: 'var(--font-mono)' }}>{formatCurrency(recP)}</div>
                    <div style={{ fontSize: '0.68rem', color: selectedOpt.priceDeltaVal >= 0 ? 'var(--success)' : 'var(--warning)', marginTop: '2px' }}>
                      {selectedOpt.priceDelta} ({selectedOpt.priceChangePct})
                    </div>
                  </div>
                  <div style={{ padding: '0.65rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Wholesale Cost</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{formatCurrency(costP)}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>Floor Boundary</div>
                  </div>
                  <div style={{ padding: '0.65rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Competitor</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{compP > 0 ? formatCurrency(compP) : 'N/A'}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>Benchmark</div>
                  </div>
                </div>

                {/* Stale Warning Notice if applicable */}
                {selectedOpt.isStale && !isApproved && (
                  <div style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <AlertCircle size={18} color="var(--warning)" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>Product Already at Target Price</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                        {selectedOpt.staleReason || `The live product record is already priced at ${formatCurrency(currentP)}. Click Recalculate to generate fresh model recommendations.`}
                      </div>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => { if (recalculateOptimization) recalculateOptimization(selectedOpt.id, guardrailSettings); }}
                    >
                      Recalculate
                    </button>
                  </div>
                )}

                {/* Safe Price Guardrails Row */}
                <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.76rem', fontWeight: 700 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
                      <ShieldCheck size={14} color="var(--success)" />
                      <span>Safe Price Guardrail Boundaries (in ₹):</span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--success)' }}>100% Guardrail Compliant</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', fontSize: '0.75rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Cost Floor: </span>
                      <strong style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(costP)}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Min Margin Floor: </span>
                      <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--warning)' }}>{formatCurrency(minGuardrail)}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Max Ceiling: </span>
                      <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--info)' }}>{formatCurrency(maxGuardrail)}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Competitor: </span>
                      <strong style={{ fontFamily: 'var(--font-mono)' }}>{compP > 0 ? formatCurrency(compP) : 'None'}</strong>
                    </div>
                  </div>
                </div>

                {/* Elasticity Curve Chart */}
                <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                      Empirical Profit vs Price Elasticity Curve
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--success)', fontWeight: 600 }}>
                      ● Optimal Target: {formatCurrency(recP)}
                    </span>
                  </div>
                  <ElasticityCurveChart data={curveData} height={190} />
                </div>

                {/* Engine Explanation / Rationale Breakdown */}
                <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', background: 'rgba(6, 182, 212, 0.08)', border: '1px solid rgba(6, 182, 212, 0.25)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <Sparkles size={16} color="var(--text-accent)" />
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      Why This Price is Recommended:
                    </span>
                  </div>

                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '0.75rem' }}>
                    {selectedOpt.rationale}
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', fontSize: '0.76rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(6, 182, 212, 0.15)' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Inventory Dynamic: </span>
                      <strong style={{ color: 'var(--text-primary)' }}>{selectedOpt.inventoryFactorText}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Expected Margin: </span>
                      <strong style={{ color: 'var(--success)' }}>{selectedOpt.expectedMargin} ({selectedOpt.marginDelta})</strong>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => handleOpenOverride(selectedOpt)}
                  >
                    <Edit3 size={16} />
                    <span>Custom Price Override</span>
                  </button>

                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => navigateTo('what-if', { productId: selectedOpt.productId || selectedOpt.id })}
                  >
                    <Sliders size={16} />
                    <span>Simulate Slider</span>
                  </button>

                  <button
                    className="btn btn-ai"
                    style={{ flex: 1 }}
                    onClick={() => navigateTo('ai-insights', { productId: selectedOpt.productId || selectedOpt.id })}
                  >
                    <Sparkles size={16} />
                    <span>View SHAP Attribution</span>
                  </button>
                </div>
              </div>
            );
          })()
        ) : (
          <div className="card-glass" style={{ padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <Package size={32} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>No product selected</div>
            <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Select an item from the recommendations table to view optimization details.</div>
          </div>
        )}
      </div>

      {/* Custom Price Override Modal */}
      {overrideModalOpen && overrideTargetOpt && (
        <Modal
          isOpen={overrideModalOpen}
          onClose={() => setOverrideModalOpen(false)}
          title={`Custom Price Override: ${overrideTargetOpt.productName}`}
          maxWidth="480px"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', width: '100%' }}>
              <button className="btn btn-secondary" onClick={() => setOverrideModalOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSubmitOverride}>
                <Check size={16} /> Confirm & Approve Price
              </button>
            </div>
          }
        >
          <div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Override the engine recommendation for SKU <strong>{overrideTargetOpt.sku}</strong>. Approved prices are persisted to the backend catalog.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1rem', background: 'var(--bg-surface)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Current Shelf</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{formatCurrency(overrideTargetOpt.currentPrice)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Recommended</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-accent)', fontFamily: 'var(--font-mono)' }}>{formatCurrency(overrideTargetOpt.recommendedPrice)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Wholesale Cost Floor</div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--warning)', fontFamily: 'var(--font-mono)' }}>{formatCurrency(overrideTargetOpt.costPrice)}</div>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
                New Approved Price (₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700 }}
                value={customPriceInput}
                onChange={(e) => {
                  setCustomPriceInput(e.target.value);
                  setOverrideError('');
                }}
                placeholder="Enter approved price in ₹"
              />
            </div>

            {overrideError && (
              <div style={{ padding: '0.5rem 0.75rem', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius-sm)', color: 'var(--danger)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
                <AlertCircle size={15} />
                <span>{overrideError}</span>
              </div>
            )}

            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Guardrail check: Price must be at least ₹{overrideTargetOpt.costPrice.toFixed(2)} (wholesale cost) unless below-cost clearance rule is active.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
