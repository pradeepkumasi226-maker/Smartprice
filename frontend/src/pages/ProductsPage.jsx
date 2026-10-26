import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  X,
  Layers,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  ShoppingBag,
  Clock,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatCurrency } from '../utils/currency';
import { ProductFormModal } from '../components/common/ProductFormModal';
import { DeleteConfirmModal } from '../components/common/DeleteConfirmModal';
import { Badge } from '../components/common/Badge';
import { mockCategories } from '../data/mockProducts';

/* ── Status Badge ── */
const StatusBadge = ({ status }) => {
  const variant =
    status === 'In Stock' ? 'success' :
    status === 'Low Stock' ? 'warning' :
    status === 'Critical' ? 'danger' :
    status === 'Overstocked' ? 'info' :
    status === 'Out of Stock' ? 'danger' : 'info';
  return <Badge variant={variant}>{status}</Badge>;
};

/* ── Dynamic Pricing Toggle ── */
const DynamicPricingToggle = ({ enabled, onToggle }) => (
  <button
    onClick={onToggle}
    style={{
      background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
      display: 'flex', alignItems: 'center',
      color: enabled ? 'var(--primary)' : 'var(--text-muted)', transition: 'color 0.2s'
    }}
    title={enabled ? 'Dynamic pricing ON' : 'Dynamic pricing OFF'}
  >
    {enabled ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
  </button>
);

/* ── Three-Dot Action Menu ── */
const ActionMenu = ({ onView, onEdit, onDelete }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="btn-icon-only"
        style={{ color: 'var(--text-secondary)' }}
        onClick={(e) => { e.stopPropagation(); setOpen(p => !p); }}
        title="Actions"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '110%',
          background: 'var(--bg-card)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-xl)',
          zIndex: 200, minWidth: '148px', overflow: 'hidden'
        }}>
          {[
            { label: 'View Product', icon: Eye, fn: onView },
            { label: 'Edit Product', icon: Edit2, fn: onEdit },
            { label: 'Delete Product', icon: Trash2, fn: onDelete, danger: true }
          ].map(({ label, icon: Icon, fn, danger }) => (
            <button
              key={label}
              onClick={(e) => { e.stopPropagation(); fn(); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
                padding: '0.6rem 1rem', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.82rem', fontWeight: 500,
                color: danger ? 'var(--danger)' : 'var(--text-primary)',
                transition: 'background 0.15s', fontFamily: 'var(--font-main)'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = danger ? 'var(--danger-bg)' : 'var(--bg-surface)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Product Details Drawer ── */
const ProductDetailsDrawer = ({ product, onClose, onEdit, navigateTo }) => {
  const price = product ? (product.current_price ?? product.currentPrice ?? 0) : 0;
  const cost = product ? (product.cost_price ?? product.cost ?? product.baseCost ?? 0) : 0;
  const stock = product ? (product.stock_quantity ?? product.stock ?? 0) : 0;
  const minStock = product ? (product.reorder_level ?? product.minimum_stock ?? product.reorderLevel ?? 30) : 30;
  const safetyStock = product ? (product.safety_stock ?? product.safetyStock ?? 10) : 10;

  // useMemo MUST be called unconditionally (before any early returns)
  const priceHistory = useMemo(() => {
    const months = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
    return months.map((m, i) => ({
      month: m,
      price: Number((price * (0.92 + i * 0.018)).toFixed(2))
    }));
  }, [product?.id, price]);

  // Early return AFTER all hooks
  if (!product) return null;

  const margin = price > 0 ? (((price - cost) / price) * 100).toFixed(1) : '0.0';
  const rec = product.recommended_price ?? product.recommendedPrice ?? price;
  const priceDiff = rec - price;

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        zIndex: 300, backdropFilter: 'blur(2px)'
      }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(480px, 95vw)', background: 'var(--bg-card)',
        borderLeft: '1px solid var(--border-default)', zIndex: 301,
        display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-xl)',
        animation: 'slideInRight 0.25s ease'
      }}>
        {/* Drawer Header */}
        <div style={{
          padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          background: 'linear-gradient(180deg, var(--bg-surface) 0%, transparent 100%)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={16} color="var(--primary)" />
              </div>
              <Badge variant="info">{product.category}</Badge>
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{product.name}</h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>SKU: {product.sku} • {product.supplier || 'Direct'}</div>
          </div>
          <button className="btn-icon-only" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Drawer Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Price/Margin */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            {[
              { label: 'Current Price', value: formatCurrency(price), color: 'var(--text-primary)', big: true },
              { label: 'Cost (COGS)', value: formatCurrency(cost), color: 'var(--text-secondary)' },
              { label: 'Gross Margin', value: `${margin}%`, color: Number(margin) > 50 ? 'var(--success)' : 'var(--warning)' }
            ].map(({ label, value, color, big }) => (
              <div key={label} style={{ padding: '0.75rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{label}</div>
                <div style={{ fontSize: big ? '1.1rem' : '0.95rem', fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Info block */}
          {[
            { title: 'Product Information', icon: Layers, rows: [
              ['Category', product.category],
              ['Brand / Supplier', product.supplier || 'Direct'],
              ['Rating', `★ ${product.rating || '4.5'} / 5.0`],
              ['Sales Velocity', product.salesVelocity || 'Moderate'],
              ['Expected Revenue', formatCurrency(product.expectedRevenue || 0)],
            ]},
            { title: 'Inventory', icon: Package, extra: <StatusBadge status={product.status} />, rows: [
              ['On Hand', `${stock} units`],
              ['Minimum Level', `${minStock} units`],
              ['Safety Stock', `${safetyStock} units`],
              ['Lead Time', `${product.leadTimeDays ?? 7} days`],
            ]},
            { title: 'AI Pricing', icon: Sparkles, rows: [
              ['Dynamic Pricing', product.dynamicPricing ? 'Active ✓' : 'Disabled'],
              ['AI Recommended', formatCurrency(rec)],
              ['Price Lift', priceDiff >= 0 ? `+${formatCurrency(priceDiff)}` : formatCurrency(priceDiff)],
              ['AI Confidence', product.aiConfidence || '90%'],
              ['Elasticity (ε)', String(product.elasticity ?? '-1.25')],
            ]}
          ].map(({ title, icon: Icon, rows, extra }) => (
            <div key={title} style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
              <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Icon size={14} color="var(--text-muted)" />
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
                {extra}
              </div>
              {rows.map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 1rem', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
          ))}

          {/* Price History */}
          <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Clock size={14} color="var(--text-muted)" />
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>Price History (6M)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.35rem', height: 50 }}>
              {priceHistory.map((pt, i) => {
                const max = Math.max(...priceHistory.map(p => p.price));
                const min = Math.min(...priceHistory.map(p => p.price));
                const range = max - min || 1;
                const pct = ((pt.price - min) / range) * 80 + 20;
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div
                      title={`${pt.month}: ${formatCurrency(pt.price)}`}
                      style={{ width: '100%', height: `${pct}%`, background: i === priceHistory.length - 1 ? 'var(--primary)' : 'var(--bg-surface-elevated)', borderRadius: '3px 3px 0 0', border: '1px solid var(--border-subtle)' }}
                    />
                    <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{pt.month}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Recommendation */}
          <div style={{ padding: '1rem', background: 'var(--primary-light)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Sparkles size={15} color="var(--primary)" />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>Optimization Recommendation</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {priceDiff > 0
                ? `Raise price by ${formatCurrency(priceDiff)} to ${formatCurrency(rec)}. Demand model shows inelastic response (ε = ${product.elasticity ?? -1.25}), supporting a ${price > 0 ? ((priceDiff / price) * 100).toFixed(1) : '0'}% margin improvement.`
                : `Current price is at or above AI optimal. Monitor competitor movement and demand signals before further adjustment.`}
            </p>
          </div>
        </div>

        {/* Drawer Footer */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { onEdit(); onClose(); }}>
            <Edit2 size={14} /> Edit Product
          </button>
          <button className="btn btn-outline" onClick={() => navigateTo('what-if', { productId: product.id })}>
            Simulate
          </button>
        </div>
      </div>
    </>
  );
};

/* ── Summary Strip ── */
const SummaryStrip = ({ products }) => {
  const total = products.length;
  const activeProducts = products.filter(p => p.status !== 'Out of Stock' && p.status !== 'Inactive').length;
  const lowStock = products.filter(p => {
    const stock = p.stock_quantity ?? p.stock ?? 0;
    const minStock = p.reorder_level ?? p.minimum_stock ?? p.reorderLevel ?? 30;
    return p.status === 'Low Stock' || p.status === 'Critical' || stock <= minStock;
  }).length;
  const avgPrice = total > 0
    ? (products.reduce((acc, p) => acc + (p.current_price ?? p.currentPrice ?? 0), 0) / total)
    : 0;
  const dynamicCount = products.filter(p => p.dynamicPricing).length;

  const stats = [
    { label: 'Total Products', value: total, icon: Package, color: 'var(--primary)', bg: 'var(--primary-light)' },
    { label: 'Active Products', value: activeProducts, icon: CheckCircle2, color: 'var(--success)', bg: 'var(--success-bg)' },
    { label: 'Low Stock', value: lowStock, icon: AlertTriangle, color: 'var(--warning)', bg: 'var(--warning-bg)' },
    { label: 'Average Price', value: formatCurrency(avgPrice), icon: TrendingUp, color: 'var(--text-accent)', bg: 'rgba(56, 189, 248, 0.12)' },
    { label: 'Dynamic Pricing', value: dynamicCount, icon: Sparkles, color: 'var(--info)', bg: 'var(--info-bg)' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
      {stats.map(({ label, value, icon: Icon, color, bg }) => (
        <div key={label} className="card-glass" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={18} color={color} />
          </div>
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

/* ── Main ProductsPage ── */
export const ProductsPage = () => {
  const {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    navigateTo,
    addToast,
    refreshProducts,
    productsLoading,
    productsError,
    isOfflineMode
  } = useStore();

  useEffect(() => {
    if (refreshProducts) {
      refreshProducts();
    }
  }, []);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [statusFilter, setStatusFilter] = useState('All');
  const [stockFilter, setStockFilter] = useState('All');
  const [dynamicFilter, setDynamicFilter] = useState('All');
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deletingProduct, setDeletingProduct] = useState(null);
  const [viewingProduct, setViewingProduct] = useState(null);

  const categoryOptions = useMemo(() => {
    const fromProducts = products.map(p => p.category).filter(Boolean);
    return Array.from(new Set(['All Categories', ...mockCategories.filter(c => c !== 'All Categories'), ...fromProducts]));
  }, [products]);

  const handleToggleDynamic = async (e, prod) => {
    e.stopPropagation();
    try {
      await updateProduct(
        prod.id,
        { dynamicPricing: !prod.dynamicPricing },
        {
          toastTitle: 'Dynamic Pricing Updated',
          toastMessage: `${prod.name}: Dynamic pricing ${!prod.dynamicPricing ? 'enabled' : 'disabled'}.`
        }
      );
    } catch (err) {
      // updateProduct will have displayed danger toast
    }
  };

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown size={11} style={{ opacity: 0.35 }} />;
    return sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />;
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return products
      .filter(p => {
        // Search filter (Product name, SKU, Category)
        if (q && !p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q) &&
            !p.category.toLowerCase().includes(q) && !(p.supplier || '').toLowerCase().includes(q)) return false;
        
        // Category filter
        if (categoryFilter !== 'All Categories' && p.category !== categoryFilter) return false;
        
        // Status filter
        if (statusFilter !== 'All' && p.status !== statusFilter) return false;
        
        // Stock filter (All, In Stock, Low Stock, Out of Stock)
        const stock = p.stock_quantity ?? p.stock ?? 0;
        const minStock = p.reorder_level ?? p.minimum_stock ?? p.reorderLevel ?? 30;
        if (stockFilter === 'In Stock') {
          if (stock <= minStock && p.status !== 'In Stock' && p.status !== 'Optimal') return false;
        } else if (stockFilter === 'Low Stock') {
          if (stock > minStock && p.status !== 'Low Stock' && p.status !== 'Critical') return false;
        } else if (stockFilter === 'Out of Stock') {
          if (stock > 0 && p.status !== 'Out of Stock') return false;
        }
        
        // Dynamic Pricing filter
        if (dynamicFilter === 'Enabled' && !p.dynamicPricing) return false;
        if (dynamicFilter === 'Disabled' && p.dynamicPricing) return false;
        return true;
      })
      .sort((a, b) => {
        let av = a[sortField], bv = b[sortField];
        if (sortField === 'currentPrice' || sortField === 'price') {
          av = a.current_price ?? a.currentPrice ?? 0;
          bv = b.current_price ?? b.currentPrice ?? 0;
        } else if (sortField === 'cost') {
          av = a.cost_price ?? a.cost ?? a.baseCost ?? 0;
          bv = b.cost_price ?? b.cost ?? b.baseCost ?? 0;
        } else if (sortField === 'stock') {
          av = a.stock_quantity ?? a.stock ?? a.stockQuantity ?? 0;
          bv = b.stock_quantity ?? b.stock ?? b.stockQuantity ?? 0;
        }
        if (typeof av === 'string') { av = av.toLowerCase(); bv = (bv || '').toLowerCase(); }
        if (av == null) av = 0;
        if (bv == null) bv = 0;
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
  }, [products, search, categoryFilter, statusFilter, stockFilter, dynamicFilter, sortField, sortDir]);

  const hasActiveFilters = search || categoryFilter !== 'All Categories' || statusFilter !== 'All' || stockFilter !== 'All' || dynamicFilter !== 'All';

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={20} color="var(--primary)" />
            </div>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800 }}>Products</h1>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: '3.25rem' }}>
            Manage your product catalog, pricing, inventory and optimization settings.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            className="btn btn-outline"
            onClick={() => refreshProducts && refreshProducts()}
            disabled={productsLoading}
            id="refresh-products-btn"
            title="Refresh products from API"
          >
            <RefreshCw size={15} style={{ animation: productsLoading ? 'spin 1s linear infinite' : 'none' }} />
            {productsLoading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)} id="add-product-btn">
            <Plus size={16} /> Add Product
          </button>
        </div>
      </div>

      {/* Offline Mode Alert */}
      {isOfflineMode && (
        <div style={{
          marginBottom: '1.25rem',
          padding: '0.75rem 1.25rem',
          background: 'rgba(234, 179, 8, 0.1)',
          border: '1px solid rgba(234, 179, 8, 0.3)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--warning)' }}>
            <AlertTriangle size={16} />
            <span>Backend API is currently offline. Viewing local demonstration fallback catalog.</span>
          </div>
          <button className="btn btn-sm btn-outline" onClick={() => refreshProducts && refreshProducts()}>
            Retry Connection
          </button>
        </div>
      )}

      {/* Summary Strip */}
      <SummaryStrip products={products} />

      {/* Filters Bar */}
      <div className="card-glass" style={{ padding: '0.85rem 1.25rem', marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            type="text" className="form-input"
            style={{ paddingLeft: '2.2rem', height: '36px', fontSize: '0.82rem' }}
            placeholder="Search products, SKU..."
            value={search} onChange={e => setSearch(e.target.value)} id="products-search"
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '2px' }}>
              <X size={13} />
            </button>
          )}
        </div>

        {/* Category Filter */}
        <select className="form-select" style={{ width: 'auto', height: '36px', fontSize: '0.82rem' }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} id="products-category-filter">
          {categoryOptions.map(c => <option key={c}>{c}</option>)}
        </select>

        {/* Status Filter */}
        <select className="form-select" style={{ width: 'auto', height: '36px', fontSize: '0.82rem' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)} id="products-status-filter">
          <option value="All">All Statuses</option>
          <option value="In Stock">In Stock</option>
          <option value="Low Stock">Low Stock</option>
          <option value="Critical">Critical</option>
          <option value="Overstocked">Overstocked</option>
          <option value="Out of Stock">Out of Stock</option>
        </select>

        {/* Stock Filter */}
        <select className="form-select" style={{ width: 'auto', height: '36px', fontSize: '0.82rem' }} value={stockFilter} onChange={e => setStockFilter(e.target.value)} id="products-stock-filter">
          <option value="All">All Stock</option>
          <option value="In Stock">In Stock</option>
          <option value="Low Stock">Low Stock</option>
          <option value="Out of Stock">Out of Stock</option>
        </select>

        {/* Dynamic Pricing Filter */}
        <select className="form-select" style={{ width: 'auto', height: '36px', fontSize: '0.82rem' }} value={dynamicFilter} onChange={e => setDynamicFilter(e.target.value)} id="products-dynamic-filter">
          <option value="All">All Pricing</option>
          <option value="Enabled">Dynamic Enabled</option>
          <option value="Disabled">Dynamic Disabled</option>
        </select>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{filtered.length} of {products.length} products</span>
          {hasActiveFilters && (
            <button className="btn btn-outline btn-sm" onClick={() => { setSearch(''); setCategoryFilter('All Categories'); setStatusFilter('All'); setStockFilter('All'); setDynamicFilter('All'); }}>
              <X size={12} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card-glass" style={{ padding: '1.5rem' }}>
        <div className="table-container">
          <table className="custom-table" id="products-table">
            <thead>
              <tr>
                <th className="sortable" onClick={() => handleSort('name')} style={{ minWidth: 220 }}>Product <SortIcon field="name" /></th>
                <th style={{ minWidth: 100 }}>SKU</th>
                <th className="sortable" onClick={() => handleSort('category')} style={{ minWidth: 130 }}>Category <SortIcon field="category" /></th>
                <th className="sortable" onClick={() => handleSort('currentPrice')} style={{ minWidth: 115 }}>Current Price <SortIcon field="currentPrice" /></th>
                <th className="sortable" onClick={() => handleSort('cost')} style={{ minWidth: 100 }}>Cost <SortIcon field="cost" /></th>
                <th className="sortable" onClick={() => handleSort('stock')} style={{ minWidth: 80 }}>Stock <SortIcon field="stock" /></th>
                <th style={{ minWidth: 115 }}>Status</th>
                <th style={{ minWidth: 115, textAlign: 'center' }}>Dynamic Pricing</th>
                <th style={{ minWidth: 110, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="9">
                    <div className="empty-state-box">
                      <div className="empty-state-icon"><Package size={26} /></div>
                      <div className="empty-state-title">{products.length === 0 ? 'No products available' : 'No products match your filters'}</div>
                      <div className="empty-state-desc">
                        {products.length === 0
                          ? 'Add products to begin demand forecasting, price optimization and inventory analysis.'
                          : 'Try adjusting your search or filter criteria.'}
                      </div>
                      {products.length === 0 ? (
                        <button className="btn btn-primary btn-sm" onClick={() => setIsAddModalOpen(true)} style={{ marginTop: '0.75rem' }}>
                          <Plus size={14} /> Add Product
                        </button>
                      ) : (
                        hasActiveFilters && (
                          <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setCategoryFilter('All Categories'); setStatusFilter('All'); setStockFilter('All'); setDynamicFilter('All'); }}>
                            Clear Filters
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(prod => {
                  const price = prod.current_price ?? prod.currentPrice ?? 0;
                  const cost = prod.cost_price ?? prod.cost ?? prod.baseCost ?? 0;
                  const stock = prod.stock_quantity ?? prod.stock ?? 0;
                  const minStock = prod.reorder_level ?? prod.minimum_stock ?? prod.reorderLevel ?? 30;
                  const margin = price > 0 ? (((price - cost) / price) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={prod.id || prod.sku} style={{ cursor: 'pointer' }} onClick={() => setViewingProduct(prod)}>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'pointer' }} onClick={() => setViewingProduct(prod)}>
                          {prod.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{prod.supplier || 'Direct'}</div>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-accent)' }}>{prod.sku}</span>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <Badge variant="info">{prod.category}</Badge>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>{formatCurrency(price)}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--success)' }}>{margin}% margin</div>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>{formatCurrency(cost)}</span>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{stock}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Min {minStock}</div>
                      </td>
                      <td onClick={e => e.stopPropagation()}><StatusBadge status={prod.status} /></td>
                      <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <DynamicPricingToggle enabled={!!prod.dynamicPricing} onToggle={(e) => handleToggleDynamic(e, prod)} />
                      </td>
                      <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'flex-end' }}>
                          <button
                            className="btn-icon-only"
                            style={{ color: 'var(--text-secondary)' }}
                            onClick={() => { setEditingProduct(prod); setViewingProduct(null); }}
                            title="Edit Product"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            className="btn-icon-only danger"
                            style={{ color: 'var(--text-muted)' }}
                            onClick={() => setDeletingProduct(prod)}
                            title="Delete Product"
                          >
                            <Trash2 size={15} />
                          </button>
                          <ActionMenu
                            onView={() => setViewingProduct(prod)}
                            onEdit={() => { setEditingProduct(prod); setViewingProduct(null); }}
                            onDelete={() => setDeletingProduct(prod)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Showing {filtered.length} product{filtered.length !== 1 ? 's' : ''}</span>
            <button className="btn btn-outline btn-sm" onClick={() => navigateTo('optimization')}>
              View Price Optimization <ArrowRight size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Drawers & Modals */}
      {viewingProduct && (
        <ProductDetailsDrawer
          product={viewingProduct}
          onClose={() => setViewingProduct(null)}
          onEdit={() => { setEditingProduct(viewingProduct); setViewingProduct(null); }}
          navigateTo={navigateTo}
        />
      )}
      <ProductFormModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={async (newProduct) => {
          try {
            await addProduct(newProduct);
            setIsAddModalOpen(false);
          } catch {}
        }}
        mode="add"
      />
      <ProductFormModal
        isOpen={Boolean(editingProduct)}
        onClose={() => setEditingProduct(null)}
        onSubmit={async (updated) => {
          try {
            await updateProduct(editingProduct.id, updated);
            setEditingProduct(null);
          } catch {}
        }}
        initialProduct={editingProduct}
        mode="edit"
      />
      <DeleteConfirmModal
        isOpen={Boolean(deletingProduct)}
        onClose={() => setDeletingProduct(null)}
        onConfirm={async (id) => {
          try {
            await deleteProduct(id);
            setDeletingProduct(null);
          } catch {}
        }}
        product={deletingProduct}
      />
    </div>
  );
};

