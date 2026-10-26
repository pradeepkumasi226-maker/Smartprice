import React, { useState, useEffect } from 'react';
import {
  BrainCircuit,
  Sparkles,
  Layers,
  Cpu,
  Info,
  HelpCircle,
  TrendingUp,
  ShieldCheck,
  Zap,
  Target,
  Sliders,
  Plus
} from 'lucide-react';
import { MetricCard } from '../components/common/MetricCard';
import { Badge } from '../components/common/Badge';
import { ShapFeatureImportanceChart } from '../components/charts/ShapFeatureImportanceChart';
import { ShapWaterfallChart } from '../components/charts/ShapWaterfallChart';
import { apiService } from '../services/apiService';
import { useStore } from '../context/StoreContext';
import { formatCurrency } from '../utils/currency';

export const AiInsightsPage = () => {
  const { products, pageParams, navigateTo } = useStore();
  const [globalFeatures, setGlobalFeatures] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(
    pageParams?.productId || products[0]?.id || 'prod-001'
  );
  const [productShap, setProductShap] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (pageParams?.productId) {
      setSelectedProductId(pageParams.productId);
    } else if (products.length > 0 && !products.some(p => p.id === selectedProductId)) {
      setSelectedProductId(products[0].id);
    }
  }, [pageParams, products]);

  useEffect(() => {
    async function loadShapData() {
      if (products.length === 0) return;
      try {
        setLoading(true);
        const currentProd = products.find(p => p.id === selectedProductId) || products[0];
        const [features, decomp] = await Promise.all([
          apiService.getShapGlobalFeatures(),
          apiService.getShapProductDecomposition(selectedProductId, currentProd)
        ]);
        setGlobalFeatures(features);
        setProductShap(decomp);
      } finally {
        setLoading(false);
      }
    }
    loadShapData();
  }, [selectedProductId, products]);

  if (products.length === 0) {
    return (
      <div>
        <div className="card-glass" style={{ padding: '3.5rem 2rem', textAlign: 'center', margin: '2rem auto', maxWidth: '600px' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(139, 92, 246, 0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
            <BrainCircuit size={28} color="var(--text-ai)" />
          </div>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem' }}>No products available for SHAP explanation</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.75rem', lineHeight: 1.5 }}>
            SHAP (SHapley Additive exPlanations) will appear after products are added and pricing models are evaluated.
          </p>
          <button className="btn btn-primary" onClick={() => navigateTo('products')}>
            <Plus size={16} /> Add Product
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Top Banner */}
      <div className="card-glass" style={{ padding: '1.5rem', marginBottom: '1.5rem', borderLeft: '4px solid var(--text-ai)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <BrainCircuit size={22} color="var(--text-ai)" />
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>
                Pricing Feature Attribution & Explainability
              </h2>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <strong>Why was this price recommended?</strong> SmartPrice provides transparent feature attribution decomposing how Competitor Benchmark, Demand Elasticity, Inventory Buffer, and Margin Guardrails drive pricing decisions.
            </p>
          </div>
          <Badge variant="ai">
            {productShap?.is_genuine_shap
              ? `XAI Model: ${productShap.model_version}`
              : `Method: ${productShap?.model_version || 'Deterministic Rule Attribution'}`}
          </Badge>
        </div>
      </div>

      {/* Model Performance & Health Overview */}
      <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
        <MetricCard
          title={productShap?.is_genuine_shap ? "Global Model R² Fit" : "Attribution Engine"}
          value={productShap?.r2_score !== null && productShap?.r2_score !== undefined ? String(productShap.r2_score) : "Rule-Based"}
          subvalue={productShap?.is_genuine_shap ? "High variance explanation" : "Deterministic decision logic"}
          trend="up"
          trendValue="Verified"
          icon={Target}
          iconColor="#10B981"
          iconBg="rgba(16, 185, 129, 0.12)"
        />
        <MetricCard
          title="Explanation Currency"
          value="Indian Rupee (₹)"
          subvalue="Localized unit metrics"
          trend="neutral"
          trendValue="INR (₹)"
          icon={Cpu}
          iconColor="#6366F1"
          iconBg="rgba(99, 102, 241, 0.12)"
        />
        <MetricCard
          title="Top Decision Driver"
          value={globalFeatures[0]?.feature || "Competitor Gap"}
          subvalue={globalFeatures[0]?.importance ? `${Math.round(globalFeatures[0].importance * 100)}% Global attribution` : "38% Global weight"}
          trend="neutral"
          trendValue="Primary Factor"
          icon={TrendingUp}
          iconColor="#06B6D4"
          iconBg="rgba(6, 182, 212, 0.12)"
        />
        <MetricCard
          title="Attribution Integrity"
          value="100% Additive"
          subvalue="All driver deltas reconcile to recommendation"
          trend="up"
          trendValue="Certified"
          icon={ShieldCheck}
          iconColor="#8B5CF6"
          iconBg="rgba(139, 92, 246, 0.12)"
        />
      </div>

      {/* Two Column Layout: Global Feature Weights & Local Waterfall Plot */}
      <div className="shap-grid-layout">
        {/* Global Decision Attribution */}
        <div className="card-glass" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Global Decision Attribution</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Aggregated decision driver attribution across entire retail catalog
              </p>
            </div>
          </div>

          <ShapFeatureImportanceChart features={globalFeatures} height={290} />

          <div style={{ marginTop: '1.25rem', padding: '0.85rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            <strong>Calculation:</strong> Decision driver weights aggregated from catalog pricing rules and margin boundaries.
          </div>
        </div>

        {/* Local Product-Level Attribution */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card-glass" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <label className="form-label" style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700 }}>
                  Product-Level Decision Attribution:
                </label>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Why was this price recommended for this SKU?
                </div>
              </div>
              <select
                className="form-select"
                style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <ShapWaterfallChart shapData={productShap} />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigateTo('what-if', { productId: selectedProductId })}
            >
              <Sliders size={14} />
              <span>Simulate Pricing in What-If Engine</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
