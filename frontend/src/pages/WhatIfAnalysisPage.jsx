import React, { useState, useEffect, useMemo } from 'react';
import {
  Sliders,
  TrendingUp,
  DollarSign,
  Package,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Percent,
  CheckCircle2,
  Layers,
  Save,
  Trash2,
  ArrowUpRight,
  Zap,
  BookmarkPlus,
  Play,
  Check,
  Flame,
  Scale,
  Crosshair,
  Minus,
  Plus,
  Info,
  AlertTriangle,
  Lightbulb,
  ShieldCheck
} from 'lucide-react';
import { MetricCard } from '../components/common/MetricCard';
import { Badge } from '../components/common/Badge';
import { SaveScenarioModal } from '../components/common/SaveScenarioModal';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { useStore } from '../context/StoreContext';
import { formatCurrency, formatCompactCurrency } from '../utils/currency';
import { calculateOptimalProfitTarget, calculateOptimalRevenueTarget } from '../utils/analytics';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell
} from 'recharts';

export const WhatIfAnalysisPage = () => {
  const {
    products = [],
    updateProduct,
    savedScenarios = [],
    saveScenario,
    deleteScenario,
    pageParams,
    navigateTo,
    addToast
  } = useStore();

  const safeProducts = Array.isArray(products) ? products : [];

  const [activeTab, setActiveTab] = useState('simulator'); // 'simulator' | 'saved' | 'compare'
  
  // Persisted or parameter-based product ID
  const [selectedProductId, setSelectedProductId] = useState(() => {
    try {
      const stored = localStorage.getItem('smartprice_selected_whatif_product_id');
      if (pageParams?.productId) return pageParams.productId;
      if (stored && safeProducts.some(p => p.id === stored || p.sku === stored)) return stored;
    } catch (e) {}
    return pageParams?.productId || safeProducts[0]?.id || '';
  });

  // Find target product with SKU and ID match support
  const selectedProduct = useMemo(() => {
    if (safeProducts.length === 0) return null;
    const match = safeProducts.find(p => p.id === selectedProductId || p.sku === selectedProductId);
    return match || safeProducts[0] || null;
  }, [safeProducts, selectedProductId]);

  const [simulatedPrice, setSimulatedPrice] = useState(() => {
    const p = safeProducts.find(prod => prod.id === (pageParams?.productId || safeProducts[0]?.id) || prod.sku === pageParams?.productId) || safeProducts[0];
    const initialPrice = Number(p?.currentPrice ?? p?.current_price ?? 100);
    return initialPrice > 0 ? initialPrice : 100;
  });
  const [competitorOffset, setCompetitorOffset] = useState(0); // -15% to +15%
  const [elasticityMultiplier, setElasticityMultiplier] = useState(1.0); // 0.5x to 2.0x
  const [promoDiscount, setPromoDiscount] = useState(0); // 0% to 30%
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

  // Sync when product changes or initial param arrives
  useEffect(() => {
    if (pageParams?.productId) {
      setSelectedProductId(pageParams.productId);
      try {
        localStorage.setItem('smartprice_selected_whatif_product_id', pageParams.productId);
      } catch (e) {}
      const target = safeProducts.find(p => p.id === pageParams.productId || p.sku === pageParams.productId);
      if (target) {
        const pVal = Number(target.currentPrice ?? target.current_price ?? 100);
        setSimulatedPrice(pVal > 0 ? pVal : 100);
        setCompetitorOffset(0);
        setElasticityMultiplier(1.0);
        setPromoDiscount(0);
      }
    } else if (safeProducts.length > 0 && (!selectedProductId || !safeProducts.some(p => p.id === selectedProductId || p.sku === selectedProductId))) {
      const fallbackId = safeProducts[0].id;
      setSelectedProductId(fallbackId);
      const pVal = Number(safeProducts[0].currentPrice ?? safeProducts[0].current_price ?? 100);
      setSimulatedPrice(pVal > 0 ? pVal : 100);
    }
  }, [pageParams, safeProducts]);

  const handleProductSelect = (id) => {
    setSelectedProductId(id);
    try {
      localStorage.setItem('smartprice_selected_whatif_product_id', id);
    } catch (e) {}
    const target = safeProducts.find(p => p.id === id || p.sku === id);
    if (target) {
      const pVal = Number(target.currentPrice ?? target.current_price ?? 100);
      setSimulatedPrice(pVal > 0 ? pVal : 100);
      setCompetitorOffset(0);
      setElasticityMultiplier(1.0);
      setPromoDiscount(0);
    }
  };

  // Real-time What-If multi-variable calculations with transparent mathematical models
  const simulationResult = useMemo(() => {
    if (!selectedProduct) return null;

    const basePrice = Number(selectedProduct.currentPrice ?? selectedProduct.current_price ?? 100);
    const baseDemand = Number(selectedProduct.predictedDemand ?? 100);
    const baseCost = Number(selectedProduct.cost ?? selectedProduct.baseCost ?? selectedProduct.cost_price ?? (basePrice * 0.5));
    const effectiveElasticity = Number(selectedProduct.elasticity ?? -1.25) * (Number(elasticityMultiplier) || 1.0);

    // Apply promotional discount to nominal proposed price
    const effectiveSimulatedPrice = Number((simulatedPrice * (1 - promoDiscount / 100)).toFixed(2));
    const priceDelta = effectiveSimulatedPrice - basePrice;
    const pricePercentDelta = basePrice > 0 ? (priceDelta / basePrice) : 0;
    
    // Cross-elasticity impact from competitor price shift
    const compDeltaDemand = (-competitorOffset * 0.4); 
    const promoDemandBoost = (promoDiscount / 100) * 0.5; // promotions stimulate demand
    const demandPercentDelta = (effectiveElasticity * pricePercentDelta) + (compDeltaDemand / 100) + promoDemandBoost;

    const simulatedDemand = Math.max(5, Math.round(baseDemand * (1 + demandPercentDelta)));
    const simulatedRevenue = Math.round(effectiveSimulatedPrice * simulatedDemand);
    const baselineRevenue = Math.round(basePrice * baseDemand);
    const revenueDelta = simulatedRevenue - baselineRevenue;
    const revenuePercentDelta = baselineRevenue > 0 ? ((revenueDelta / baselineRevenue) * 100).toFixed(1) : '0.0';

    const simulatedCost = Math.round(baseCost * simulatedDemand);
    const simulatedProfit = simulatedRevenue - simulatedCost;
    const baselineCost = Math.round(baseCost * baseDemand);
    const baselineProfit = baselineRevenue - baselineCost;
    const profitDelta = simulatedProfit - baselineProfit;
    const profitPercentDelta = baselineProfit > 0 ? (((profitDelta) / baselineProfit) * 100).toFixed(1) : '0.0';
    const marginPercent = simulatedRevenue > 0 ? (((simulatedRevenue - simulatedCost) / simulatedRevenue) * 100).toFixed(1) : '0.0';
    const baselineMargin = baselineRevenue > 0 ? (((baselineRevenue - baselineCost) / baselineRevenue) * 100).toFixed(1) : '0.0';

    const rawComp = Number(selectedProduct.competitorPrice ?? selectedProduct.competitor_price ?? (basePrice * 1.05));
    const effectiveCompetitor = Number((rawComp * (1 + competitorOffset / 100)).toFixed(2));

    // Dynamic Recommendation Rule Engine
    let recommendation = {
      type: "neutral",
      headline: "Neutral Simulation",
      details: "Price changes result in balanced trade-offs between demand volume and margins.",
      action: "Maintain or fine-tune"
    };

    if (profitDelta > 0 && revenueDelta > 0) {
      recommendation = {
        type: "positive",
        headline: "High-Yield Optimal Strategy",
        details: `Simulated price yields +${formatCurrency(profitDelta, { decimals: 0 })} (+${profitPercentDelta}%) additional profit and expands gross revenue.`,
        action: "Recommended for implementation"
      };
    } else if (profitDelta > 0 && revenueDelta <= 0) {
      recommendation = {
        type: "positive",
        headline: "Margin Optimization Strategy",
        details: `Higher margin offset absorbs volume contraction, expanding total profit by +${formatCurrency(profitDelta, { decimals: 0 })}.`,
        action: "Recommended for supply-constrained periods"
      };
    } else if (profitDelta <= 0 && simulatedDemand > baseDemand) {
      recommendation = {
        type: "warning",
        headline: "Volume Over Margin Expansion",
        details: `Unit demand increases (+${simulatedDemand - baseDemand} units), but lower shelf price compresses total gross profit by ${formatCurrency(profitDelta, { decimals: 0 })}.`,
        action: "Suitable for inventory clearance only"
      };
    } else if (profitDelta < 0 && simulatedDemand < baseDemand) {
      recommendation = {
        type: "danger",
        headline: "Sub-Optimal Margin Contraction",
        details: `Demand elasticity penalty causes lost transactions that exceed unit margin gains.`,
        action: "Not recommended"
      };
    }

    return {
      product: selectedProduct,
      simulatedPrice: effectiveSimulatedPrice,
      rawSimulatedPrice: simulatedPrice,
      baselinePrice: basePrice,
      simulatedDemand,
      baselineDemand: baseDemand,
      demandDelta: simulatedDemand - baseDemand,
      demandPercentDelta: (demandPercentDelta * 100).toFixed(1),
      simulatedRevenue,
      baselineRevenue,
      revenueDelta,
      revenuePercentDelta: Number(revenuePercentDelta),
      simulatedProfit,
      baselineProfit,
      profitDelta,
      profitPercentDelta,
      marginPercent: `${marginPercent}%`,
      baselineMargin: `${baselineMargin}%`,
      effectiveCompetitor,
      isPriceHigherThanCompetitor: effectiveSimulatedPrice > effectiveCompetitor,
      recommendation
    };
  }, [selectedProduct, simulatedPrice, competitorOffset, elasticityMultiplier, promoDiscount]);

  // Strategy Presets Handlers
  const resetToBaseline = () => {
    if (selectedProduct) {
      const current = Number(selectedProduct.currentPrice ?? selectedProduct.current_price ?? 100);
      setSimulatedPrice(current);
      setCompetitorOffset(0);
      setElasticityMultiplier(1.0);
      setPromoDiscount(0);
      addToast("Simulator Reset", `Restored baseline price of ${formatCurrency(current)}`, "info");
    }
  };

  const applyOptimal = () => {
    if (selectedProduct) {
      const optResult = calculateOptimalProfitTarget(selectedProduct, {
        elasticityMultiplier,
        competitorOffset,
        promoDiscount
      });
      setSimulatedPrice(optResult.price);
      if (optResult.isModelDerived) {
        addToast("Applied AI Optimal", `Target set to profit-maximizing ${formatCurrency(optResult.price)} (+${formatCurrency(optResult.profitLift, { decimals: 0 })} estimated profit lift)`, "info");
      } else if (optResult.isHeuristic) {
        addToast("Applied Heuristic Target", `Target set to heuristic simulation price ${formatCurrency(optResult.price)} (+5% margin capture within guardrails)`, "info");
      } else {
        addToast("Applied AI Optimal", `Target set to recommended ${formatCurrency(optResult.price)}`, "info");
      }
    }
  };

  const applyMaxRevenue = () => {
    if (selectedProduct) {
      const optResult = calculateOptimalRevenueTarget(selectedProduct, {
        elasticityMultiplier,
        competitorOffset,
        promoDiscount
      });
      setSimulatedPrice(optResult.price);
      if (optResult.isModelDerived) {
        addToast(
          "Max Revenue Preset",
          `Target set to revenue-maximizing ${formatCurrency(optResult.price)} (+${formatCurrency(optResult.revenueLift, { decimals: 0 })} estimated revenue expansion)`,
          "info"
        );
      } else {
        addToast(
          "Max Revenue Preset",
          `Target set to ${formatCurrency(optResult.price)} within guardrails`,
          "info"
        );
      }
    }
  };

  const applyUndercutCompetitor = () => {
    if (selectedProduct) {
      const comp = Number(selectedProduct.competitorPrice ?? selectedProduct.competitor_price ?? ((selectedProduct.currentPrice ?? 100) * 1.05));
      const p = Number((comp * 0.97).toFixed(2));
      const minP = Number(selectedProduct.minPrice ?? ((selectedProduct.cost ?? selectedProduct.baseCost ?? 50) * 1.1));
      const boundedP = Math.max(minP, p);
      setSimulatedPrice(boundedP);
      addToast("Undercut Competitor Preset", `Set to 3% below market at ${formatCurrency(boundedP)}`, "info");
    }
  };

  const applyClearanceMode = () => {
    if (selectedProduct) {
      const cost = Number(selectedProduct.cost ?? selectedProduct.baseCost ?? selectedProduct.cost_price ?? ((selectedProduct.currentPrice ?? 100) * 0.5));
      const rawPrice = Number((cost * 1.15).toFixed(2));
      const minP = Number(selectedProduct.minPrice ?? (cost > 0 ? cost * 1.05 : rawPrice));
      const maxP = Number(selectedProduct.maxPrice ?? (rawPrice * 1.5));
      const boundedP = Number(Math.min(maxP, Math.max(minP, rawPrice)).toFixed(2));
      setSimulatedPrice(boundedP);
      addToast("Clearance & Liquidation Preset", `Priced at cost + 15% margin (${formatCurrency(boundedP)}) to maximize inventory turnover`, "warning");
    }
  };

  const applyToLiveStore = async () => {
    if (!selectedProduct) return;
    try {
      await updateProduct(
        selectedProduct.id,
        { currentPrice: simulatedPrice, current_price: simulatedPrice },
        {
          toastTitle: "Price Pushed to Live Catalog",
          toastMessage: `${selectedProduct.name} updated to ${formatCurrency(simulatedPrice)} across POS registers and database.`
        }
      );
    } catch {}
  };

  const loadScenarioIntoSimulator = (scenario) => {
    setSelectedProductId(scenario.productId || scenario.product_id);
    setSimulatedPrice(scenario.simulatedPrice || scenario.simulated_price);
    setActiveTab('simulator');
    addToast(
      "Scenario Loaded",
      `Loaded "${scenario.name}" (${formatCurrency(scenario.simulatedPrice || scenario.simulated_price)}) into simulator.`,
      "info"
    );
  };

  // Recharts Comparison Data
  const comparisonChartData = simulationResult ? [
    {
      metric: "Gross Revenue",
      "Current Scenario": simulationResult.baselineRevenue,
      "What-If Scenario": simulationResult.simulatedRevenue
    },
    {
      metric: "Gross Profit",
      "Current Scenario": simulationResult.baselineProfit,
      "What-If Scenario": simulationResult.simulatedProfit
    },
    {
      metric: "Demand Units",
      "Current Scenario": simulationResult.baselineDemand,
      "What-If Scenario": simulationResult.simulatedDemand
    }
  ] : [];

  const priceDelta = simulationResult ? simulationResult.simulatedPrice - simulationResult.baselinePrice : 0;
  const priceDeltaPercent = simulationResult && simulationResult.baselinePrice
    ? ((priceDelta / simulationResult.baselinePrice) * 100).toFixed(1)
    : '0.0';

  if (safeProducts.length === 0) {
    return (
      <ErrorBoundary onNavigateHome={() => navigateTo('dashboard')}>
        <div>
          <div className="card-glass" style={{ padding: '3.5rem 2rem', textAlign: 'center', margin: '2rem auto', maxWidth: '600px' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--primary-light)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <Sliders size={28} color="var(--primary)" />
            </div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem' }}>No products available for What-If simulation</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.75rem', lineHeight: 1.5 }}>
              Add products to simulate dynamic pricing, price sensitivity curves, competitor shifts, and revenue scenarios.
            </p>
            <button className="btn btn-primary" onClick={() => navigateTo('products')}>
              <Plus size={16} /> Add Product
            </button>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  if (!selectedProduct) {
    return (
      <ErrorBoundary onNavigateHome={() => navigateTo('dashboard')}>
        <div>
          <div className="card-glass" style={{ padding: '3.5rem 2rem', textAlign: 'center', margin: '2rem auto', maxWidth: '640px' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(99, 102, 241, 0.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <Sliders size={28} color="var(--primary)" />
            </div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              Select a product to start a What-If simulation
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.75rem', lineHeight: 1.5 }}>
              Select a product from Products or Demand Forecast to start a What-If simulation.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => navigateTo('products')}>
                <Package size={16} /> Go to Products
              </button>
              <button className="btn btn-secondary" onClick={() => navigateTo('forecast')}>
                <TrendingUp size={16} /> Go to Demand Forecast
              </button>
            </div>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  const prodCost = Number(selectedProduct?.cost ?? selectedProduct?.baseCost ?? selectedProduct?.cost_price ?? 0);
  const prodCurrentPrice = Number(selectedProduct?.currentPrice ?? selectedProduct?.current_price ?? 0);
  const prodCompPrice = Number(selectedProduct?.competitorPrice ?? selectedProduct?.competitor_price ?? 0);
  const optimalProfitTarget = useMemo(() => {
    return calculateOptimalProfitTarget(selectedProduct, {
      elasticityMultiplier,
      competitorOffset,
      promoDiscount
    });
  }, [selectedProduct, elasticityMultiplier, competitorOffset, promoDiscount]);
  const prodRecPrice = optimalProfitTarget.price;
  const prodMinPrice = Number(selectedProduct?.minPrice ?? (prodCost > 0 ? prodCost * 1.05 : prodCurrentPrice * 0.5));
  const prodMaxPrice = Number(selectedProduct?.maxPrice ?? (prodCurrentPrice > 0 ? prodCurrentPrice * 1.5 : 1000));
  const prodStock = Number(selectedProduct?.stock ?? selectedProduct?.currentStock ?? selectedProduct?.inventory ?? 0);
  const prodElasticity = Number(selectedProduct?.elasticity ?? -1.25);

  return (
    <ErrorBoundary onNavigateHome={() => navigateTo('dashboard')}>
      <div>
        {/* Top Banner & Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sliders size={22} color="var(--primary)" />
              <span>Live Price Simulation — Current Price vs What-If Price</span>
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Interactive dynamic simulation modeling price changes, empirical elasticity, competitor shifts, demand lift/decline, and margin guardrails in real time.
            </p>
          </div>

          {/* Tab switcher */}
          <div className="demo-btn-group" style={{ margin: 0 }}>
            <button
              className={`btn btn-sm ${activeTab === 'simulator' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('simulator')}
            >
              <Sliders size={14} />
              <span>Simulator Engine</span>
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'compare' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('compare')}
            >
              <Scale size={14} />
              <span>Scenario Comparison ({savedScenarios.length})</span>
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'saved' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('saved')}
            >
              <BookmarkPlus size={14} />
              <span>Saved Drafts</span>
            </button>
          </div>
        </div>

        {activeTab === 'simulator' && (
          <div className="simulator-layout">
            {/* Left Simulator Controls */}
            <div className="simulator-controls-panel">
              <div>
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>1. Select Retail Product</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{safeProducts.length} Products</span>
                </label>
                <select
                  className="form-select"
                  value={selectedProductId}
                  onChange={(e) => handleProductSelect(e.target.value)}
                >
                  {safeProducts.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — {formatCurrency(p.currentPrice || p.current_price)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Product Baseline Snapshot */}
              <div style={{ padding: '0.85rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.35rem', marginBottom: '0.2rem' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{selectedProduct.name}</span>
                  <Badge variant="purple">{selectedProduct.sku}</Badge>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Cost of Goods (COGS):</span>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(prodCost)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Current Shelf Price:</span>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(prodCurrentPrice)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Competitor Benchmark:</span>
                  <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-accent)' }}>{formatCurrency(prodCompPrice)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>AI Recommended Price:</span>
                  <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>{formatCurrency(prodRecPrice)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Price Guardrails:</span>
                  <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>{formatCurrency(prodMinPrice)} – {formatCurrency(prodMaxPrice)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Current Warehouse Stock:</span>
                  <strong>{prodStock} units</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Historical Elasticity (&epsilon;):</span>
                  <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-accent)' }}>{prodElasticity.toFixed(2)}</strong>
                </div>
              </div>

              {/* Strategy Preset Buttons */}
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  Strategy Presets:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                  <button className="btn btn-secondary btn-sm" style={{ fontSize: '0.74rem' }} onClick={applyOptimal}>
                    <Sparkles size={12} color="var(--primary)" />
                    <span>Max Profit (AI)</span>
                  </button>
                  <button className="btn btn-secondary btn-sm" style={{ fontSize: '0.74rem' }} onClick={applyMaxRevenue}>
                    <TrendingUp size={12} color="#10B981" />
                    <span>Max Revenue</span>
                  </button>
                  <button className="btn btn-secondary btn-sm" style={{ fontSize: '0.74rem' }} onClick={applyUndercutCompetitor}>
                    <Crosshair size={12} color="#38BDF8" />
                    <span>Undercut Comp -3%</span>
                  </button>
                  <button className="btn btn-secondary btn-sm" style={{ fontSize: '0.74rem' }} onClick={applyClearanceMode}>
                    <Flame size={12} color="#F59E0B" />
                    <span>Clearance Mode</span>
                  </button>
                </div>
              </div>

              {/* 3. Proposed Price Slider & Input */}
              <div className="price-slider-box">
                <div className="slider-price-display">
                  <div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      3. Proposed Price
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                      <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>₹</span>
                      <input
                        type="number"
                        step="any"
                        min={1}
                        max={10000000}
                        value={simulatedPrice}
                        onChange={(e) => setSimulatedPrice(parseFloat(e.target.value) || 0)}
                        style={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-strong)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--text-primary)',
                          padding: '0.2rem 0.5rem',
                          fontSize: '1.3rem',
                          fontWeight: 800,
                          fontFamily: 'var(--font-mono)',
                          width: '140px'
                        }}
                      />
                    </div>
                  </div>

                  <div className={`delta-badge ${priceDelta >= 0 ? 'delta-positive' : 'delta-negative'}`}>
                    {priceDelta >= 0 ? `+${priceDeltaPercent}%` : `${priceDeltaPercent}%`}
                  </div>
                </div>

                {/* Stepper Buttons */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                  <button className="chip-btn" onClick={() => setSimulatedPrice(prev => Math.max(1, Number((prev - (prev > 1000 ? 500 : 5)).toFixed(2))))}>-{simulatedPrice > 1000 ? '₹500' : '₹5'}</button>
                  <button className="chip-btn" onClick={() => setSimulatedPrice(prev => Math.max(1, Number((prev - (prev > 1000 ? 100 : 1)).toFixed(2))))}>-{simulatedPrice > 1000 ? '₹100' : '₹1'}</button>
                  <button className="chip-btn" onClick={() => setSimulatedPrice(prev => Number((prev + (prev > 1000 ? 100 : 1)).toFixed(2)))}>+{simulatedPrice > 1000 ? '₹100' : '₹1'}</button>
                  <button className="chip-btn" onClick={() => setSimulatedPrice(prev => Number((prev + (prev > 1000 ? 500 : 5)).toFixed(2)))}>+{simulatedPrice > 1000 ? '₹500' : '₹5'}</button>
                </div>

                <input
                  type="range"
                  className="custom-range"
                  min={Math.min(prodMinPrice, simulatedPrice > 0 ? Math.round(simulatedPrice * 0.7) : 1)}
                  max={Math.max(prodMaxPrice, simulatedPrice > 0 ? Math.round(simulatedPrice * 1.3) : 1000)}
                  step={simulatedPrice > 5000 ? 50 : 1}
                  value={simulatedPrice}
                  onChange={(e) => setSimulatedPrice(parseFloat(e.target.value))}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <span>Floor: {formatCurrency(prodMinPrice)}</span>
                  <span style={{ color: 'var(--text-accent)' }}>Current: {formatCurrency(prodCurrentPrice)}</span>
                  <span>Ceiling: {formatCurrency(prodMaxPrice)}</span>
                </div>
              </div>

              {/* 4 & 5. Demand Factors & Promotion Percentage */}
              <div style={{ padding: '0.85rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  4 & 5. Promotion & Demand Factors
                </div>

                {/* Promotion Markdown Slider */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                    <span>4. Promotion Discount (%):</span>
                    <strong style={{ color: promoDiscount > 0 ? 'var(--warning)' : 'inherit' }}>{promoDiscount}% OFF</strong>
                  </div>
                  <input
                    type="range"
                    className="custom-range"
                    min={0}
                    max={30}
                    step={5}
                    value={promoDiscount}
                    onChange={(e) => setPromoDiscount(parseInt(e.target.value, 10))}
                  />
                </div>

                {/* Competitor Price Shift */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                    <span>5a. Competitor Price Shift:</span>
                    <strong style={{ color: competitorOffset !== 0 ? '#38BDF8' : 'inherit' }}>{competitorOffset > 0 ? `+${competitorOffset}%` : `${competitorOffset}%`}</strong>
                  </div>
                  <input
                    type="range"
                    className="custom-range"
                    min={-15}
                    max={15}
                    step={1}
                    value={competitorOffset}
                    onChange={(e) => setCompetitorOffset(parseInt(e.target.value, 10))}
                  />
                </div>

                {/* Elasticity Multiplier */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                    <span>5b. Elasticity Multiplier:</span>
                    <strong>{elasticityMultiplier}x</strong>
                  </div>
                  <input
                    type="range"
                    className="custom-range"
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    value={elasticityMultiplier}
                    onChange={(e) => setElasticityMultiplier(parseFloat(e.target.value))}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button
                  className="btn btn-ai"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => setIsSaveModalOpen(true)}
                >
                  <Save size={15} />
                  <span>Save As Staged Scenario</span>
                </button>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={resetToBaseline}
                  >
                    <RotateCcw size={14} />
                    <span>Reset</span>
                  </button>

                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={applyToLiveStore}
                  >
                    <CheckCircle2 size={14} />
                    <span>Push Live</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Simulation Impact Dashboard */}
            <div className="simulator-results-panel">
              {/* 9. Simulation Recommendation Callout Banner */}
              <div
                className="card-glass"
                style={{
                  padding: '1.25rem 1.5rem',
                  marginBottom: '1.5rem',
                  borderLeft: `4px solid ${
                    simulationResult?.recommendation?.type === 'positive' ? 'var(--success)' :
                    simulationResult?.recommendation?.type === 'danger' ? 'var(--danger)' :
                    simulationResult?.recommendation?.type === 'warning' ? 'var(--warning)' : 'var(--primary)'
                  }`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.85rem' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '8px',
                      background: simulationResult?.recommendation?.type === 'positive' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: simulationResult?.recommendation?.type === 'positive' ? 'var(--success)' : 'var(--primary)'
                    }}>
                      <Lightbulb size={20} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: 800 }}>
                          9. Recommendation: {simulationResult?.recommendation?.headline || 'Simulation Recommendation'}
                        </h4>
                        <Badge variant={
                          simulationResult?.recommendation?.type === 'positive' ? 'success' :
                          simulationResult?.recommendation?.type === 'danger' ? 'danger' :
                          simulationResult?.recommendation?.type === 'warning' ? 'warning' : 'info'
                        }>
                          {simulationResult?.recommendation?.action || 'Evaluate'}
                        </Badge>
                      </div>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.35rem', lineHeight: 1.5 }}>
                        {simulationResult?.recommendation?.details || 'Evaluate simulated pricing scenario against baseline performance.'}
                      </p>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Net Profit Impact</div>
                    <div style={{
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      fontFamily: 'var(--font-mono)',
                      color: (simulationResult?.profitDelta ?? 0) >= 0 ? 'var(--success)' : 'var(--danger)'
                    }}>
                      {formatCurrency(simulationResult?.profitDelta || 0, { showSign: true, decimals: 0 })}
                    </div>
                  </div>
                </div>
              </div>

            {/* 6 & 7. KPI Outcome Cards (Estimated Demand, Revenue, Profit & Margin) */}
            <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
              <MetricCard
                title="7. Estimated Revenue"
                value={formatCurrency(simulationResult?.simulatedRevenue || 0, { decimals: 0 })}
                subvalue={`Baseline: ${formatCurrency(simulationResult?.baselineRevenue || 0, { decimals: 0 })}`}
                trend={simulationResult?.revenueDelta >= 0 ? "up" : "down"}
                trendValue={`${simulationResult?.revenuePercentDelta > 0 ? '+' : ''}${simulationResult?.revenuePercentDelta}%`}
                icon={DollarSign}
                iconColor="#6366F1"
                iconBg="rgba(99, 102, 241, 0.12)"
              />

              <MetricCard
                title="6. Estimated Demand"
                value={`${simulationResult?.simulatedDemand} units`}
                subvalue={`Baseline: ${simulationResult?.baselineDemand} units`}
                trend={simulationResult?.demandDelta >= 0 ? "up" : "down"}
                trendValue={`${simulationResult?.demandPercentDelta > 0 ? '+' : ''}${simulationResult?.demandPercentDelta}%`}
                icon={Package}
                iconColor="#06B6D4"
                iconBg="rgba(6, 182, 212, 0.12)"
              />

              <MetricCard
                title="Estimated Profit"
                value={formatCurrency(simulationResult?.simulatedProfit || 0, { decimals: 0 })}
                subvalue={`Baseline: ${formatCurrency(simulationResult?.baselineProfit || 0, { decimals: 0 })}`}
                trend={simulationResult?.profitDelta >= 0 ? "up" : "down"}
                trendValue={formatCurrency(simulationResult?.profitDelta || 0, { showSign: true, decimals: 0 })}
                icon={TrendingUp}
                iconColor="#10B981"
                iconBg="rgba(16, 185, 129, 0.12)"
              />

              <MetricCard
                title="Estimated Margin"
                value={simulationResult?.marginPercent || '0%'}
                subvalue={`Baseline Margin: ${simulationResult?.baselineMargin || '0%'}`}
                trend="up"
                trendValue={`COGS: ${formatCurrency(selectedProduct?.cost ?? selectedProduct?.baseCost ?? selectedProduct?.cost_price ?? 0)}`}
                icon={Percent}
                iconColor="#8B5CF6"
                iconBg="rgba(139, 92, 246, 0.12)"
              />
            </div>

            {/* 8. Interactive Comparison Chart: Current Scenario vs What-If Scenario */}
            <div className="card-glass" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                    8. Current Scenario vs What-If Scenario Comparison
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Visual comparative analysis of Revenue (₹), Gross Profit (₹), and Sales Volume (Units)
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <div style={{ width: '12px', height: '12px', background: '#64748B', borderRadius: '2px' }}></div>
                    <span style={{ color: 'var(--text-secondary)' }}>Current ({formatCurrency(simulationResult?.baselinePrice)})</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <div style={{ width: '12px', height: '12px', background: '#6366F1', borderRadius: '2px' }}></div>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>What-If ({formatCurrency(simulationResult?.simulatedPrice)})</span>
                  </div>
                </div>
              </div>

              <div className="chart-wrapper" style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" vertical={false} />
                    <XAxis dataKey="metric" stroke="#64748B" fontSize={12} tickLine={false} />
                    <YAxis stroke="#64748B" fontSize={12} tickLine={false} tickFormatter={(v) => formatCompactCurrency(v)} />
                    <Tooltip
                      formatter={(value, name) => [
                        name.includes('Units') || value < 1000 ? `${value} units` : formatCurrency(value, { decimals: 0 }),
                        name
                      ]}
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        borderColor: 'var(--border-strong)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="Current Scenario" fill="#64748B" radius={[4, 4, 0, 0]} barSize={34} />
                    <Bar dataKey="What-If Scenario" fill="#6366F1" radius={[4, 4, 0, 0]} barSize={34} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Transparent Mathematical Assumptions & College Demo Guide Box */}
            <div className="card-glass" style={{ padding: '1.25rem 1.5rem', background: 'rgba(30, 41, 59, 0.5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Info size={16} color="var(--primary)" />
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                  Transparent Mathematical Simulation Model (Assumptions & Formulations)
                </h4>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <div style={{ padding: '0.6rem 0.8rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>1. Price Elasticity of Demand:</div>
                    <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-accent)', fontSize: '0.74rem' }}>
                      &Delta;D% = (&epsilon; &times; Multiplier) &times; &Delta;P% + PromoBoost
                    </div>
                    <div>Where &epsilon; = {selectedProduct?.elasticity ?? -1.25} for this category.</div>
                  </div>
                  <div style={{ padding: '0.6rem 0.8rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>2. Revenue & Gross Profit Calculation:</div>
                    <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-accent)', fontSize: '0.74rem' }}>
                      Revenue = P_simulated &times; D_simulated
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-accent)', fontSize: '0.74rem' }}>
                      Gross Profit = (P_simulated - Cost) &times; D_simulated
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scenario Comparison Tab */}
      {activeTab === 'compare' && (
        <div className="card-glass" style={{ padding: '1.5rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Side-by-Side Scenario Comparative Matrix</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Compare financial yields and demand projections across different simulated strategies.
            </p>
          </div>

          <div className="grid-3">
            {/* Live Baseline Card */}
            <div className="scenario-card baseline-card">
              <div className="scenario-card-header">
                <Badge variant="info">Current Active Shelf</Badge>
                <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{selectedProduct?.name || 'Selected Product'}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>SKU: {selectedProduct?.sku || 'N/A'}</div>
              </div>

              <div className="scenario-price-tag">
                <span className="price-label">Shelf Price:</span>
                <span className="price-val">{formatCurrency(selectedProduct?.currentPrice ?? selectedProduct?.current_price ?? 0)}</span>
              </div>

              <div className="scenario-metrics-list">
                <div className="scen-row">
                  <span>Gross Revenue:</span>
                  <strong>{formatCurrency((Number(selectedProduct?.currentPrice ?? selectedProduct?.current_price ?? 0)) * (Number(selectedProduct?.predictedDemand ?? 100)), { decimals: 0 })}</strong>
                </div>
                <div className="scen-row">
                  <span>Unit Demand:</span>
                  <strong>{selectedProduct?.predictedDemand ?? 100} units</strong>
                </div>
                <div className="scen-row">
                  <span>Gross Profit:</span>
                  <strong>{formatCurrency(((Number(selectedProduct?.currentPrice ?? selectedProduct?.current_price ?? 0)) - (Number(selectedProduct?.cost ?? selectedProduct?.baseCost ?? selectedProduct?.cost_price ?? 0))) * (Number(selectedProduct?.predictedDemand ?? 100)), { decimals: 0 })}</strong>
                </div>
                <div className="scen-row">
                  <span>Gross Margin:</span>
                  <strong>
                    {(() => {
                      const p = Number(selectedProduct?.currentPrice ?? selectedProduct?.current_price ?? 0);
                      const c = Number(selectedProduct?.cost ?? selectedProduct?.baseCost ?? selectedProduct?.cost_price ?? 0);
                      return p > 0 ? `${(((p - c) / p) * 100).toFixed(1)}%` : '0.0%';
                    })()}
                  </strong>
                </div>
              </div>
            </div>

            {/* Saved Scenarios Cards */}
            {savedScenarios.map((scen) => {
              return (
                <div key={scen.id} className="scenario-card">
                  <div className="scenario-card-header">
                    <Badge variant="purple">{scen.name}</Badge>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '0.3rem' }}>{scen.productName}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Saved: {scen.dateSaved || 'Recently'}</div>
                  </div>

                  <div className="scenario-price-tag">
                    <span className="price-label">Simulated Price:</span>
                    <span className="price-val" style={{ color: 'var(--text-accent)' }}>{formatCurrency(scen.simulatedPrice || scen.simulated_price)}</span>
                  </div>

                  <div className="scenario-metrics-list">
                    <div className="scen-row">
                      <span>Projected Revenue:</span>
                      <strong>{formatCurrency(scen.simulatedRevenue || scen.expected_revenue, { decimals: 0 })}</strong>
                    </div>
                    <div className="scen-row">
                      <span>Projected Demand:</span>
                      <strong>{scen.simulatedDemand || scen.expected_demand} units</strong>
                    </div>
                    <div className="scen-row">
                      <span>Projected Profit:</span>
                      <strong style={{ color: 'var(--success)' }}>{formatCurrency(scen.simulatedProfit || scen.expected_gross_profit, { decimals: 0 })}</strong>
                    </div>
                    <div className="scen-row">
                      <span>Projected Margin:</span>
                      <strong>{scen.simulatedGrossMargin || scen.expected_margin}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '1rem' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1 }}
                      onClick={() => loadScenarioIntoSimulator(scen)}
                    >
                      <Play size={12} />
                      <span>Load into Slider</span>
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => deleteScenario(scen.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Saved Scenarios Tab */}
      {activeTab === 'saved' && (
        <div className="card-glass" style={{ padding: '1.5rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Saved What-If Staging Scenarios</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Historical pricing experiments saved for executive stakeholder reviews.
            </p>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Scenario Name</th>
                  <th>Product / SKU</th>
                  <th>Simulated Price</th>
                  <th>Projected Revenue</th>
                  <th>Projected Profit</th>
                  <th>Margin</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {savedScenarios.length === 0 ? (
                  <tr>
                    <td colSpan="8">
                      <div className="empty-state-box">
                        <div className="empty-state-title">No saved scenarios found</div>
                        <div className="empty-state-desc">Use the Simulator Engine to create and save price experiments.</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  savedScenarios.map((scen) => (
                    <tr key={scen.id}>
                      <td style={{ fontWeight: 700 }}>{scen.name}</td>
                      <td>
                        <div>{scen.productName || scen.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{scen.sku || 'SKU-001'}</div>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--text-accent)', fontFamily: 'var(--font-mono)' }}>
                        {formatCurrency(scen.simulatedPrice || scen.simulated_price)}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        {formatCurrency(scen.simulatedRevenue || scen.expected_revenue, { decimals: 0 })}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--success)', fontWeight: 700 }}>
                        {formatCurrency(scen.simulatedProfit || scen.expected_gross_profit, { decimals: 0 })}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        {scen.simulatedGrossMargin || scen.expected_margin}
                      </td>
                      <td>
                        <Badge variant="purple">{scen.status || 'Staged Draft'}</Badge>
                      </td>
                      <td>
                        <div className="table-action-group" style={{ justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => loadScenarioIntoSimulator(scen)}
                          >
                            <Play size={13} />
                            <span>Load</span>
                          </button>
                          <button
                            className="btn-icon-only danger"
                            onClick={() => deleteScenario(scen.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Save Scenario Modal */}
      <SaveScenarioModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={saveScenario}
        product={selectedProduct}
        simulatedPrice={simulatedPrice}
        simulationResult={simulationResult}
      />
      </div>
    </ErrorBoundary>
  );
};
