import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  Package,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Filter,
  BarChart3,
  ExternalLink,
  Layers,
  Plus,
  Edit2,
  Trash2,
  Sliders,
  Search,
  RotateCcw,
  CheckSquare,
  Square,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Truck,
  Percent
} from 'lucide-react';
import { MetricCard } from '../components/common/MetricCard';
import { Badge } from '../components/common/Badge';
import { AlertBanner } from '../components/common/AlertBanner';
import { RevenueTrendChart } from '../components/charts/RevenueTrendChart';
import { DemandForecastChart } from '../components/charts/DemandForecastChart';
import { ProductFormModal } from '../components/common/ProductFormModal';
import { DeleteConfirmModal } from '../components/common/DeleteConfirmModal';
import { BatchActionToolbar } from '../components/common/BatchActionToolbar';
import { useStore } from '../context/StoreContext';
import { apiService } from '../services/apiService';
import { formatCurrency, formatCompactCurrency } from '../utils/currency';
import {
  filterSalesData,
  calculateSalesMetrics,
  calculateMonthlySalesTrends
} from '../utils/analytics';
import { mockDemandTimeline } from '../data/mockForecasts';

export const DashboardPage = () => {
  const {
    products,
    sales,
    inventory,
    salesMetrics,
    inventoryMetrics,
    addProduct,
    updateProduct,
    deleteProduct,
    batchDeleteProducts,
    batchApplyAiPrices,
    optimizations,
    approvePriceOptimization,
    rejectPriceOptimization,
    batchApproveAll,
    navigateTo,
    searchQuery,
    setSearchQuery,
    selectedStore,
    selectedProductIds,
    toggleProductSelection,
    selectAllProducts,
    clearProductSelection,
    addToast,
    isOfflineMode,
    refreshProducts
  } = useStore();

  // Filters & Sorting state
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [revenueHorizon, setRevenueHorizon] = useState('ytd');
  const [forecastHorizon, setForecastHorizon] = useState('7d');

  // Live Backend Data States
  const [liveSummary, setLiveSummary] = useState(null);
  const [liveSalesTrends, setLiveSalesTrends] = useState(null);
  const [liveForecastPoints, setLiveForecastPoints] = useState(null);
  const [dashError, setDashError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isCancelled = false;
    async function loadLiveDashboardData() {
      if (isOfflineMode) {
        setLiveSummary(null);
        setLiveSalesTrends(null);
        setLiveForecastPoints(null);
        return;
      }
      try {
        setDashError(null);
        const [sum, salesT, forecastRes] = await Promise.allSettled([
          apiService.getDashboardSummary(),
          apiService.getSales(),
          apiService.getDemandForecast(forecastHorizon)
        ]);

        if (!isCancelled) {
          if (sum.status === 'fulfilled' && sum.value) {
            setLiveSummary(sum.value);
          }
          if (salesT.status === 'fulfilled' && Array.isArray(salesT.value)) {
            setLiveSalesTrends(salesT.value);
          }
          if (forecastRes.status === 'fulfilled' && forecastRes.value && Array.isArray(forecastRes.value.points)) {
            setLiveForecastPoints(forecastRes.value.points);
          }
        }
      } catch (err) {
        if (!isCancelled) {
          setDashError(err.message || 'Live dashboard data unreachable');
        }
      }
    }
    loadLiveDashboardData();
    return () => { isCancelled = true; };
  }, [isOfflineMode, forecastHorizon, retryCount]);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deletingProduct, setDeletingProduct] = useState(null);

  // Dynamic Sales Metrics based on active Horizon & Store filters
  const filteredSales = useMemo(() => {
    return filterSalesData(sales, {
      dateRange: revenueHorizon,
      category: selectedCategory,
      store: selectedStore
    });
  }, [sales, revenueHorizon, selectedCategory, selectedStore]);

  const activePeriodMetrics = useMemo(() => {
    return calculateSalesMetrics(filteredSales);
  }, [filteredSales]);

  // Dynamic Chart Data calculated from filtered sales records
  const revenueChartData = useMemo(() => {
    return calculateMonthlySalesTrends(filteredSales);
  }, [filteredSales]);

  const demandForecastData = useMemo(() => {
    if (liveForecastPoints && liveForecastPoints.length > 0) {
      return liveForecastPoints;
    }
    return mockDemandTimeline[forecastHorizon] || mockDemandTimeline['7d'];
  }, [liveForecastPoints, forecastHorizon]);

  // Sorting handler
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filtered & Sorted Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.supplier && p.supplier.toLowerCase().includes(q));
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      const matchesStatus = selectedStatus === 'All' ||
        p.status === selectedStatus ||
        (selectedStatus === 'In Stock' && (p.status === 'Optimal' || p.status === 'In Stock')) ||
        (selectedStatus === 'Optimal' && (p.status === 'Optimal' || p.status === 'In Stock'));
      return matchesSearch && matchesCategory && matchesStatus;
    }).sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [products, searchQuery, selectedCategory, selectedStatus, sortField, sortDirection]);

  const pendingOptimizations = optimizations.filter(o => (o.status === 'Pending Approval' || o.status === 'Pending') && !o.isStale && !o.is_stale);
  const lowStockProducts = products.filter(p => p.status === 'Low Stock' || p.status === 'Critical');

  // Select all visible
  const isAllSelected = filteredProducts.length > 0 && filteredProducts.every(p => selectedProductIds.includes(p.id));

  const handleSelectAllToggle = () => {
    if (isAllSelected) {
      clearProductSelection();
    } else {
      selectAllProducts(filteredProducts.map(p => p.id));
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return <ArrowUpDown size={12} style={{ opacity: 0.4 }} />;
    return sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  };

  return (
    <div>
      {/* Top Banner Explaining SmartPrice System Purpose */}
      {/* Offline Mode Indicator Banner */}
      {(isOfflineMode || dashError) && (
        <div style={{
          marginBottom: '1.25rem',
          padding: '0.75rem 1.25rem',
          background: 'rgba(234, 179, 8, 0.1)',
          border: '1px solid rgba(234, 179, 8, 0.3)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.6rem',
          color: 'var(--warning)',
          fontSize: '0.82rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <AlertTriangle size={16} />
            <span><strong>Offline Mode:</strong> {dashError ? `Backend service notice: ${dashError}. ` : 'Backend service is currently unreachable. '}Financial sales figures and metrics shown are cached demonstration benchmarks, not live database transactions.</span>
          </div>
          <button
            className="btn btn-sm btn-outline"
            onClick={() => {
              setRetryCount(prev => prev + 1);
              if (refreshProducts) refreshProducts();
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <RotateCcw size={13} /> Retry Live Connection
          </button>
        </div>
      )}

      <AlertBanner
        title={`SmartPrice AI Retail Decision-Support System (${pendingOptimizations.length} Pricing Opportunities)`}
        description="Empirical elasticity modeling, probabilistic demand forecasting, inventory reorder intelligence, and explainable AI (SHAP) for retail pricing managers."
        actionText="Review Price Optimization"
        onAction={() => navigateTo('optimization')}
      />

      {/* SmartPrice Core Workflow Navigator */}
      <div className="card-glass" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem', borderTop: '3px solid var(--primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Sparkles size={16} color="var(--primary)" />
              <span>SmartPrice Decision Workflow</span>
            </h3>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
              Follow the end-to-end AI retail pricing pipeline from catalog intake to explainable business audits
            </p>
          </div>
          <Badge variant="ai">Project Workflow Active</Badge>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
          {[
            { step: '1', name: 'ADD PRODUCT', page: 'products', desc: 'Catalog & Cost' },
            { step: '2', name: 'DEMAND FORECAST', page: 'forecast', desc: 'P10–P90 Confidence' },
            { step: '3', name: 'PRICE OPTIMIZATION', page: 'optimization', desc: 'Elasticity & Guardrails' },
            { step: '4', name: 'WHAT-IF SIMULATOR', page: 'what-if', desc: 'Live Price Simulation' },
            { step: '5', name: 'INVENTORY INTELLIGENCE', page: 'inventory', desc: 'Valuation & Low Stock' },
            { step: '6', name: 'SHAP EXPLANATIONS', page: 'ai-insights', desc: 'Feature Contributions' },
            { step: '7', name: 'BUSINESS REPORTS', page: 'reports', desc: 'CSV / PDF Audits' }
          ].map(({ step, name, page, desc }) => (

            <button
              key={step}
              onClick={() => navigateTo(page)}
              style={{
                padding: '0.65rem 0.5rem',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.2rem'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.transform = 'none'; }}
            >
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 800, fontSize: '0.72rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {step}
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>{name}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards Row with Real Calculated SmartPrice Metrics */}
      <div className="grid-4" style={{ marginBottom: '1.75rem' }}>
        <MetricCard
          title="Forecasted Demand"
          value={products.length > 0 ? `${products.reduce((acc, p) => acc + (p.predictedDemand || 100), 0).toLocaleString()} units` : 'No data available'}
          subvalue={products.length > 0 ? `Across ${products.length} catalog products` : 'Add products to forecast'}
          trend="up"
          trendValue={products.length > 0 ? "Active" : "Pending"}
          icon={TrendingUp}
          iconColor="#10B981"
          iconBg="rgba(16, 185, 129, 0.12)"
          onClick={() => navigateTo('forecast')}
        />
        <MetricCard
          title="Current Inventory"
          value={products.length > 0 ? `${inventoryMetrics.totalStockUnits.toLocaleString()} units` : '0 units'}
          subvalue={products.length > 0 ? `Valuation: ${formatCurrency(inventoryMetrics.warehouseValuation, { decimals: 0 })}` : 'No inventory available'}
          trend="neutral"
          trendValue={`${inventoryMetrics.healthyStockPercentage}% Healthy`}
          icon={Package}
          iconColor="#6366F1"
          iconBg="rgba(99, 102, 241, 0.12)"
          onClick={() => navigateTo('inventory')}
        />
        <MetricCard
          title="Low Stock Alerts"
          value={`${inventoryMetrics.lowStockItemsCount + inventoryMetrics.criticalItemsCount} item${(inventoryMetrics.lowStockItemsCount + inventoryMetrics.criticalItemsCount) !== 1 ? 's' : ''}`}
          subvalue={products.length > 0 ? `${inventoryMetrics.criticalItemsCount} critical out of stock` : '0 alerts'}
          trend={inventoryMetrics.criticalItemsCount > 0 ? "down" : "up"}
          trendValue={inventoryMetrics.criticalItemsCount > 0 ? "Reorder Needed" : "Sufficient"}
          icon={AlertTriangle}
          iconColor={inventoryMetrics.criticalItemsCount > 0 ? "#EF4444" : "#F59E0B"}
          iconBg="rgba(239, 68, 68, 0.12)"
          onClick={() => navigateTo('inventory')}
        />
        <MetricCard
          title="Optimization Opportunities"
          value={`${pendingOptimizations.length} SKU${pendingOptimizations.length !== 1 ? 's' : ''}`}
          subvalue={optimizations.length > 0 ? `${optimizations.filter(o => o.status === 'Approved').length} prices active / approved` : '0 opportunities'}
          trend="up"
          trendValue={pendingOptimizations.length > 0 ? `${pendingOptimizations.length} Actionable` : "Ready"}
          icon={Sparkles}
          iconColor="#06B6D4"
          iconBg="rgba(6, 182, 212, 0.12)"
          glow={pendingOptimizations.length > 0}
          onClick={() => navigateTo('optimization')}
        />
      </div>

      {/* Product Management Quick-Action Card */}
      <div
        className="card-glass"
        style={{
          padding: '1.25rem 1.5rem',
          marginBottom: '1.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          borderLeft: '4px solid var(--primary)',
          background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(99,102,241,0.06) 100%)',
          cursor: 'pointer'
        }}
        onClick={() => navigateTo('products')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 'var(--radius-md)',
            background: 'var(--primary-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Layers size={22} color="var(--primary)" />
          </div>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Product Catalog & Inventory Management</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {products.length > 0
                ? `${products.length} product${products.length > 1 ? 's' : ''} across ${[...new Set(products.map(p => p.category))].length} categories • Manage pricing bounds, costs and stock levels`
                : 'No products added yet. Click "+ Add Product" to begin demand forecasting and price optimization.'}
            </div>
          </div>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={(e) => { e.stopPropagation(); navigateTo('products'); }}
          id="dashboard-view-products-btn"
        >
          {products.length > 0 ? 'Manage Products' : '+ Add First Product'}
          <ArrowRight size={14} />
        </button>
      </div>


      {/* Charts Section Row */}
      <div className="dashboard-charts-row">
        {/* Revenue Trend Chart */}
        <div className="card-glass" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Realized Sales Revenue Trajectory</h3>
                <Badge variant={isOfflineMode ? "warning" : "success"}>
                  {isOfflineMode ? "Offline Demo Benchmarks" : "Live Store Ledger"}
                </Badge>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Computed from {isOfflineMode ? 'cached benchmark ledger' : 'live transaction ledgers'} ({revenueHorizon.toUpperCase()})
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <div className="demo-btn-group" style={{ margin: 0 }}>
                <button
                  className={`btn btn-sm ${revenueHorizon === '3m' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setRevenueHorizon('3m')}
                >
                  3M
                </button>
                <button
                  className={`btn btn-sm ${revenueHorizon === '6m' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setRevenueHorizon('6m')}
                >
                  6M
                </button>
                <button
                  className={`btn btn-sm ${revenueHorizon === 'ytd' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setRevenueHorizon('ytd')}
                >
                  YTD
                </button>
              </div>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => navigateTo('reports')}
              >
                Report
              </button>
            </div>
          </div>
          <RevenueTrendChart data={revenueChartData} height={290} />
        </div>

        {/* Demand Forecast Chart */}
        <div className="card-glass" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Demand Forecast Horizon</h3>
                <Badge variant={liveForecastPoints ? "ai" : "warning"}>
                  {liveForecastPoints ? "Live Forecast Model" : "Demo Benchmark"}
                </Badge>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {liveForecastPoints ? "Empirical model projection from backend" : "P50 predicted volume with confidence bands"}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <div className="demo-btn-group" style={{ margin: 0 }}>
                <button
                  className={`btn btn-sm ${forecastHorizon === '7d' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setForecastHorizon('7d')}
                >
                  7D
                </button>
                <button
                  className={`btn btn-sm ${forecastHorizon === '30d' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setForecastHorizon('30d')}
                >
                  30D
                </button>
                <button
                  className={`btn btn-sm ${forecastHorizon === '90d' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setForecastHorizon('90d')}
                >
                  90D
                </button>
              </div>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => navigateTo('forecast')}
              >
                Forecast
              </button>
            </div>
          </div>
          <DemandForecastChart data={demandForecastData} height={290} />
        </div>
      </div>

      {/* Main Catalog Table & Side Action Panel */}
      <div className="dashboard-grid-hero">
        {/* Left: Product Catalog Table */}
        <div className="card-glass" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Product Catalog & Inventory Matrix</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Showing {filteredProducts.length} of {products.length} products • Connected to live sales & stock ledgers
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Category Filter */}
              <select
                className="form-select"
                style={{ width: 'auto', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="All">All Categories</option>
                <option value="Electronics">Electronics</option>
                <option value="Apparel">Apparel</option>
                <option value="Home & Kitchen">Home & Kitchen</option>
                <option value="Groceries">Groceries</option>
                <option value="Health & Beauty">Health & Beauty</option>
              </select>

              {/* Status Filter */}
              <select
                className="form-select"
                style={{ width: 'auto', padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="In Stock">In Stock</option>
                <option value="Low Stock">Low Stock</option>
                <option value="Critical">Critical</option>
                <option value="Overstocked">Overstocked</option>
              </select>

              {/* Add Product Button */}
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setIsAddModalOpen(true)}
              >
                <Plus size={15} />
                <span>Add Product</span>
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleSelectAllToggle}
                      style={{ cursor: 'pointer' }}
                      title="Select all products"
                    />
                  </th>
                  <th className="sortable" onClick={() => handleSort('name')}>
                    Product / SKU / Supplier {getSortIcon('name')}
                  </th>
                  <th className="sortable" onClick={() => handleSort('cost')}>
                    Cost (COGS) {getSortIcon('cost')}
                  </th>
                  <th className="sortable" onClick={() => handleSort('currentPrice')}>
                    Selling Price {getSortIcon('currentPrice')}
                  </th>
                  <th className="sortable" onClick={() => handleSort('recommendedPrice')}>
                    AI Optimal {getSortIcon('recommendedPrice')}
                  </th>
                  <th className="sortable" onClick={() => handleSort('stock')}>
                    Stock (Min) {getSortIcon('stock')}
                  </th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan="8">
                      <div className="empty-state-box">
                        <div className="empty-state-icon">
                          <Search size={24} />
                        </div>
                        <div className="empty-state-title">No products found</div>
                        <div className="empty-state-desc">
                          No items match your active search "{searchQuery}" or category filters.
                        </div>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setSearchQuery('');
                            setSelectedCategory('All');
                            setSelectedStatus('All');
                          }}
                        >
                          Clear Filters
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((prod) => {
                    const price = prod.current_price || prod.currentPrice;
                    const cost = prod.cost || prod.baseCost;
                    const rec = prod.recommendedPrice;
                    const priceDiff = rec - price;
                    const isSelected = selectedProductIds.includes(prod.id);

                    return (
                      <tr
                        key={prod.id}
                        style={{
                          backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.08)' : undefined
                        }}
                      >
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleProductSelection(prod.id)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                            {prod.name}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            {prod.sku} • {prod.category} • <span style={{ color: 'var(--text-secondary)' }}>{prod.supplier || 'Direct'}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                          {formatCurrency(cost)}
                        </td>
                        <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                          {formatCurrency(price)}
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: priceDiff > 0 ? 'var(--success)' : priceDiff < 0 ? 'var(--danger)' : 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                            {formatCurrency(rec)}
                          </span>
                          <div style={{ fontSize: '0.72rem', color: priceDiff > 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {formatCurrency(priceDiff, { showSign: true })}
                          </div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600 }}>{prod.stock} units</span>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            Min: {prod.minimum_stock || prod.reorderLevel}
                          </div>
                        </td>
                        <td>
                          <Badge
                            variant={
                              (prod.status === 'In Stock' || prod.status === 'Optimal') ? 'success' :
                              prod.status === 'Low Stock' ? 'warning' :
                              prod.status === 'Critical' ? 'danger' : 'info'
                            }
                          >
                            {prod.status}
                          </Badge>
                        </td>
                        <td>
                          <div className="table-action-group" style={{ justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => navigateTo('what-if', { productId: prod.id })}
                              title="Simulate price change in What-If engine"
                            >
                              <Sliders size={13} />
                              <span>Simulate</span>
                            </button>

                            <button
                              className="btn-icon-only primary"
                              onClick={() => setEditingProduct(prod)}
                              title="Edit product parameters"
                            >
                              <Edit2 size={14} />
                            </button>

                            <button
                              className="btn-icon-only danger"
                              onClick={() => setDeletingProduct(prod)}
                              title="Delete product"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Showing {filteredProducts.length} items
            </span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigateTo('optimization')}
            >
              <span>View Full Pricing Matrix</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Right Sidebar: AI Action Center & Low Stock Warnings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Pending Recommendations Card */}
          <div className="card-glass" style={{ padding: '1.5rem', borderLeft: '4px solid var(--primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={18} color="var(--primary)" />
                <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>AI Price Approvals</h4>
              </div>
              <Badge variant="purple">{pendingOptimizations.length} Pending</Badge>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Machine-generated price adjustments computed from real-time competitor scrapers and elasticity models.
            </p>

            {pendingOptimizations.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: '1rem' }}>
                <CheckCircle2 size={24} color="var(--success)" style={{ margin: '0 auto 0.5rem' }} />
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>All recommendations applied!</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>POS prices are synchronized.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                {pendingOptimizations.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-surface)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <div style={{ maxWidth: '60%' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.productName}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {formatCurrency(item.currentPrice)} → <strong style={{ color: 'var(--text-accent)' }}>{formatCurrency(item.recommendedPrice)}</strong>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => approvePriceOptimization(item.id)}
                        title="Accept recommendation"
                      >
                        Accept
                      </button>
                      <button
                        className="btn-icon-only danger"
                        onClick={() => rejectPriceOptimization(item.id)}
                        title="Dismiss recommendation"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-ai btn-sm"
                style={{ width: '100%' }}
                onClick={batchApproveAll}
                disabled={pendingOptimizations.length === 0}
              >
                Approve All Pending ({pendingOptimizations.length})
              </button>
            </div>
          </div>

          {/* Low Stock Alerts Card */}
          <div className="card-glass" style={{ padding: '1.5rem', borderLeft: '4px solid var(--warning)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={18} color="var(--warning)" />
                <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>Low-Stock Alerts</h4>
              </div>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => navigateTo('inventory')}
              >
                Manage
              </button>
            </div>

            {lowStockProducts.length === 0 ? (
              <div style={{ padding: '1.25rem', textAlign: 'center', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)' }}>
                <CheckCircle2 size={22} color="var(--success)" style={{ margin: '0 auto 0.35rem' }} />
                <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>All SKUs sufficiently stocked</div>
              </div>
            ) : (
              <div className="alert-feed-list">
                {lowStockProducts.map(p => (
                  <div
                    key={p.id}
                    className={`alert-feed-item ${p.status === 'Critical' ? 'danger' : ''}`}
                    onClick={() => navigateTo('inventory')}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Stock: <strong style={{ color: p.status === 'Critical' ? 'var(--danger)' : 'var(--warning)' }}>{p.stock} units</strong> (Min: {p.minimum_stock || p.reorderLevel})
                      </div>
                    </div>
                    <Badge variant={p.status === 'Critical' ? 'danger' : 'warning'}>
                      {p.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Multi-Select Toolbar */}
      <BatchActionToolbar
        selectedIds={selectedProductIds}
        onClear={clearProductSelection}
        onBatchOptimize={() => batchApplyAiPrices(selectedProductIds)}
        onBatchDelete={() => batchDeleteProducts(selectedProductIds)}
      />

      {/* Add Product Modal */}
      <ProductFormModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={addProduct}
        mode="add"
      />

      {/* Edit Product Modal */}
      <ProductFormModal
        isOpen={Boolean(editingProduct)}
        onClose={() => setEditingProduct(null)}
        onSubmit={(updated) => updateProduct(editingProduct.id, updated)}
        initialProduct={editingProduct}
        mode="edit"
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(deletingProduct)}
        onClose={() => setDeletingProduct(null)}
        onConfirm={deleteProduct}
        product={deletingProduct}
      />
    </div>
  );
};
