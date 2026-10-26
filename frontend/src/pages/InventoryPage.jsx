import React, { useState, useMemo, useEffect } from 'react';
import {
  Boxes,
  PackagePlus,
  AlertTriangle,
  CheckCircle,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  History,
  RotateCcw,
  Truck,
  Plus,
  Edit2,
  Trash2,
  Sliders,
  DollarSign,
  Tag,
  ShieldCheck,
  Zap,
  X,
  CheckSquare,
  Square,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  SlidersHorizontal,
  FileSpreadsheet
} from 'lucide-react';
import { MetricCard } from '../components/common/MetricCard';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { ProductFormModal } from '../components/common/ProductFormModal';
import { DeleteConfirmModal } from '../components/common/DeleteConfirmModal';
import { BatchActionToolbar } from '../components/common/BatchActionToolbar';
import { useStore } from '../context/StoreContext';
import { formatCurrency } from '../utils/currency';

export const InventoryPage = () => {
  const {
    products,
    inventory,
    inventoryMetrics,
    addProduct,
    updateProduct,
    deleteProduct,
    batchDeleteProducts,
    batchApplyAiPrices,
    restockProduct,
    quickInlineUpdate,
    selectedProductIds,
    toggleProductSelection,
    selectAllProducts,
    clearProductSelection,
    searchQuery,
    setSearchQuery,
    pageParams,
    navigateTo
  } = useStore();

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedSupplier, setSelectedSupplier] = useState('All');
  const [minPriceFilter, setMinPriceFilter] = useState('');
  const [maxPriceFilter, setMaxPriceFilter] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [sortField, setSortField] = useState('stock');
  const [sortDirection, setSortDirection] = useState('asc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // 10, 25, 50, or 'all'

  // Inline Editing State
  // inlineEditing: { productId, field, value }
  const [inlineEditing, setInlineEditing] = useState(null);

  // Restock Modal
  const [restockModalOpen, setRestockModalOpen] = useState(false);
  const [selectedProductForRestock, setSelectedProductForRestock] = useState(null);
  const [restockQuantity, setRestockQuantity] = useState(50);
  const [restockError, setRestockError] = useState('');

  // CRUD Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(Boolean(pageParams?.openAdd));
  const [editingProduct, setEditingProduct] = useState(null);
  const [deletingProduct, setDeletingProduct] = useState(null);

  useEffect(() => {
    if (pageParams?.openAdd) {
      setIsAddModalOpen(true);
    }
  }, [pageParams]);

  // Sorting
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return <ArrowUpDown size={12} style={{ opacity: 0.4 }} />;
    return sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  };

  // Status priority for sorting
  const statusPriority = {
    'Critical': 1,
    'Low Stock': 2,
    'In Stock': 3,
    'Optimal': 3,
    'Overstocked': 4
  };

  // Get unique suppliers
  const suppliers = useMemo(() => {
    const set = new Set(products.map(p => p.supplier).filter(Boolean));
    return Array.from(set);
  }, [products]);

  // Filtered & Sorted Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.supplier && p.supplier.toLowerCase().includes(q));
      const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
      const matchesStat = selectedStatus === 'All' ||
        p.status === selectedStatus ||
        (selectedStatus === 'In Stock' && (p.status === 'Optimal' || p.status === 'In Stock')) ||
        (selectedStatus === 'Optimal' && (p.status === 'Optimal' || p.status === 'In Stock'));
      const matchesSup = selectedSupplier === 'All' || p.supplier === selectedSupplier;

      const price = p.currentPrice || p.current_price;
      const matchesMinP = !minPriceFilter || price >= Number(minPriceFilter);
      const matchesMaxP = !maxPriceFilter || price <= Number(maxPriceFilter);

      return matchesSearch && matchesCat && matchesStat && matchesSup && matchesMinP && matchesMaxP;
    }).sort((a, b) => {
      if (sortField === 'status') {
        const aPri = statusPriority[a.status] || 99;
        const bPri = statusPriority[b.status] || 99;
        return sortDirection === 'asc' ? aPri - bPri : bPri - aPri;
      }

      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === 'cost') {
        aVal = a.cost || a.baseCost || 0;
        bVal = b.cost || b.baseCost || 0;
      } else if (sortField === 'price' || sortField === 'currentPrice') {
        aVal = a.currentPrice || a.current_price || 0;
        bVal = b.currentPrice || b.current_price || 0;
      }

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [products, searchQuery, selectedCategory, selectedStatus, selectedSupplier, minPriceFilter, maxPriceFilter, sortField, sortDirection]);

  // Paginated records
  const totalPages = pageSize === 'all' ? 1 : Math.ceil(filteredProducts.length / pageSize) || 1;
  const paginatedProducts = useMemo(() => {
    if (pageSize === 'all') return filteredProducts;
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  // Adjust page when filtered list changes
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  // Multi-selection helpers
  const isAllSelected = paginatedProducts.length > 0 && paginatedProducts.every(p => selectedProductIds.includes(p.id));
  const isSomeSelected = paginatedProducts.some(p => selectedProductIds.includes(p.id)) && !isAllSelected;

  const handleSelectAllToggle = () => {
    if (isAllSelected) {
      const pageIds = paginatedProducts.map(p => p.id);
      selectAllProducts(selectedProductIds.filter(id => !pageIds.includes(id)));
    } else {
      const pageIds = paginatedProducts.map(p => p.id);
      selectAllProducts(Array.from(new Set([...selectedProductIds, ...pageIds])));
    }
  };

  // Inline Quick-Edit Handlers
  const startInlineEdit = (productId, field, currentValue) => {
    setInlineEditing({ productId, field, value: String(currentValue) });
  };

  const commitInlineEdit = () => {
    if (!inlineEditing) return;
    const { productId, field, value } = inlineEditing;
    quickInlineUpdate(productId, field, value);
    setInlineEditing(null);
  };

  const cancelInlineEdit = () => {
    setInlineEditing(null);
  };

  // Open Restock Modal with pre-calculated suggested quantity
  const handleOpenRestock = (product) => {
    setSelectedProductForRestock(product);
    const minStock = Number(product.minimum_stock || product.reorderLevel) || 30;
    const currentStock = Number(product.stock) || 0;
    const suggested = Math.max(20, (minStock * 2) - currentStock);
    setRestockQuantity(suggested);
    setRestockError('');
    setRestockModalOpen(true);
  };

  // Confirm Restock Action
  const handleConfirmRestock = async () => {
    if (!selectedProductForRestock) return;
    
    const qtyStr = String(restockQuantity).trim();
    if (!qtyStr || isNaN(qtyStr)) {
      setRestockError('Please enter a valid numeric reorder quantity.');
      return;
    }

    const qty = parseInt(qtyStr, 10);
    if (qty <= 0) {
      setRestockError('Reorder quantity must be a positive number greater than 0.');
      return;
    }

    if (qty > 10000) {
      setRestockError('Reorder quantity exceeds maximum single PO limit (10,000 units).');
      return;
    }

    try {
      await restockProduct(selectedProductForRestock.id, qty, "Retail Inventory Specialist");
      setRestockModalOpen(false);
    } catch (err) {
      setRestockError(err.message || 'Restock failed on server.');
    }
  };

  if (products.length === 0) {
    return (
      <div>
        <div className="card-glass" style={{ padding: '3.5rem 2rem', textAlign: 'center', margin: '2rem auto', maxWidth: '600px' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--warning-bg)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
            <Boxes size={28} color="var(--warning)" />
          </div>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem' }}>No inventory data available</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.75rem', lineHeight: 1.5 }}>
            Add products to track stock levels, reorder thresholds, inventory replenishment, and warehouse valuation.
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
      {/* Floating Batch Actions Toolbar */}
      <BatchActionToolbar
        selectedIds={selectedProductIds}
        onClear={clearProductSelection}
        onBatchOptimize={() => batchApplyAiPrices(selectedProductIds)}
        onBatchDelete={() => batchDeleteProducts(selectedProductIds)}
      />

      {/* KPI Overview with Live Dynamic Calculations */}
      <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
        <MetricCard
          title="Total Stock On-Hand"
          value={inventoryMetrics.totalStockUnits.toLocaleString()}
          subvalue={`Across ${products.length} Catalog SKUs`}
          trend="neutral"
          trendValue="Live Synced"
          icon={Boxes}
          iconColor="#6366F1"
          iconBg="rgba(99, 102, 241, 0.12)"
        />
        <MetricCard
          title="Warehouse Stock Valuation"
          value={formatCurrency(inventoryMetrics.warehouseValuation, { decimals: 0 })}
          subvalue="Calculated as (units on hand × wholesale cost)"
          trend="up"
          trendValue="+4.2%"
          icon={Truck}
          iconColor="#10B981"
          iconBg="rgba(16, 185, 129, 0.12)"
        />
        <MetricCard
          title="Critical & Low Stock SKUs"
          value={`${inventoryMetrics.criticalItemsCount + inventoryMetrics.lowStockItemsCount} SKUs`}
          subvalue={`${inventoryMetrics.criticalItemsCount} Critical / ${inventoryMetrics.lowStockItemsCount} Low Stock`}
          trend={inventoryMetrics.criticalItemsCount + inventoryMetrics.lowStockItemsCount > 0 ? "down" : "up"}
          trendValue={inventoryMetrics.criticalItemsCount > 0 ? "Action Needed" : "Protected"}
          icon={AlertTriangle}
          iconColor={inventoryMetrics.criticalItemsCount > 0 ? "#EF4444" : "#F59E0B"}
          iconBg={inventoryMetrics.criticalItemsCount > 0 ? "rgba(239, 68, 68, 0.12)" : "rgba(245, 158, 11, 0.12)"}
        />
        <MetricCard
          title="Healthy Stock Ratio"
          value={`${inventoryMetrics.healthyStockPercentage}%`}
          subvalue="Sufficient buffer vs supplier lead time"
          trend="up"
          trendValue="Optimal"
          icon={CheckCircle}
          iconColor="#06B6D4"
          iconBg="rgba(6, 182, 212, 0.12)"
        />
      </div>

      {/* Filter and Inventory Table */}
      <div className="card-glass" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Inventory Health & Replenishment Matrix</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Double-click Price, Cost, or Stock cells for instant inline quick-editing.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Status Filter Dropdown */}
            <select
              className="form-select"
              style={{ width: 'auto', fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="All">All Stock Statuses</option>
              <option value="Critical">Critical</option>
              <option value="Low Stock">Low Stock</option>
              <option value="In Stock">In Stock</option>
              <option value="Overstocked">Overstocked</option>
            </select>

            {/* Category Filter Dropdown */}
            <select
              className="form-select"
              style={{ width: 'auto', fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="All">All Categories</option>
              <option value="Electronics">Electronics</option>
              <option value="Apparel">Apparel</option>
              <option value="Home & Kitchen">Home & Kitchen</option>
              <option value="Groceries">Groceries</option>
              <option value="Health & Beauty">Health & Beauty</option>
              <option value="Sports & Outdoors">Sports & Outdoors</option>
            </select>

            {/* Advanced Filters Toggle */}
            <button
              className={`btn btn-sm ${showAdvancedFilters ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              title="Toggle advanced column and price range filters"
            >
              <SlidersHorizontal size={14} />
              <span>Filters</span>
            </button>

            <button
              className="btn btn-primary btn-sm"
              onClick={() => setIsAddModalOpen(true)}
            >
              <Plus size={15} />
              <span>Add SKU</span>
            </button>
          </div>
        </div>

        {/* Expandable Advanced Filter Panel */}
        {showAdvancedFilters && (
          <div className="advanced-filter-panel animate-fade-in" style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.3rem' }}>Supplier / Vendor:</label>
                <select
                  className="form-select"
                  style={{ width: 'auto', fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                >
                  <option value="All">All Suppliers</option>
                  {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.3rem' }}>Min Price (₹):</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={minPriceFilter}
                    onChange={(e) => setMinPriceFilter(e.target.value)}
                    style={{ width: '80px', padding: '0.3rem 0.5rem', fontSize: '0.8rem', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '4px', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.3rem' }}>Max Price (₹):</label>
                  <input
                    type="number"
                    placeholder="9999"
                    value={maxPriceFilter}
                    onChange={(e) => setMaxPriceFilter(e.target.value)}
                    style={{ width: '80px', padding: '0.3rem 0.5rem', fontSize: '0.8rem', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '4px', color: '#fff' }}
                  />
                </div>
              </div>

              <button
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 'auto', fontSize: '0.78rem' }}
                onClick={() => {
                  setSelectedCategory('All');
                  setSelectedStatus('All');
                  setSelectedSupplier('All');
                  setMinPriceFilter('');
                  setMaxPriceFilter('');
                  setSearchQuery('');
                }}
              >
                Reset All Filters
              </button>
            </div>
          </div>
        )}

        {/* Status Filter Badges (Quick 1-Click filter buttons) */}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '0.25rem' }}>Quick Status:</span>
          {['All', 'Critical', 'Low Stock', 'In Stock', 'Overstocked'].map(stat => (
            <button
              key={stat}
              className={`btn btn-sm ${selectedStatus === stat ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.74rem', padding: '0.2rem 0.6rem' }}
              onClick={() => setSelectedStatus(stat)}
            >
              {stat}
            </button>
          ))}
        </div>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => { if (el) el.indeterminate = isSomeSelected; }}
                    onChange={handleSelectAllToggle}
                    title="Select all products on page"
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th className="sortable" onClick={() => handleSort('name')}>
                  Product / SKU / Supplier {getSortIcon('name')}
                </th>
                <th className="sortable" onClick={() => handleSort('category')}>
                  Category {getSortIcon('category')}
                </th>
                <th className="sortable" onClick={() => handleSort('price')}>
                  Selling Price {getSortIcon('price')}
                </th>
                <th className="sortable" onClick={() => handleSort('cost')}>
                  Wholesale Cost {getSortIcon('cost')}
                </th>
                <th className="sortable" onClick={() => handleSort('stock')} style={{ minWidth: '140px' }}>
                  Stock Gauge & Level {getSortIcon('stock')}
                </th>
                <th className="sortable" onClick={() => handleSort('minimum_stock')}>
                  Reorder Point {getSortIcon('minimum_stock')}
                </th>
                <th className="sortable" onClick={() => handleSort('status')}>
                  Status {getSortIcon('status')}
                </th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan="9">
                    <div className="empty-state-box">
                      <div className="empty-state-icon">
                        <Search size={24} />
                      </div>
                      <div className="empty-state-title">No inventory items found</div>
                      <div className="empty-state-desc">
                        No products match your active search "{searchQuery}" or selected filters.
                      </div>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedCategory('All');
                          setSelectedStatus('All');
                          setSelectedSupplier('All');
                          setMinPriceFilter('');
                          setMaxPriceFilter('');
                        }}
                      >
                        Reset Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((p) => {
                  const isSelected = selectedProductIds.includes(p.id);
                  const isCritical = p.status === 'Critical';
                  const isLow = p.status === 'Low Stock';
                  const cost = p.cost || p.baseCost || 0;
                  const price = p.currentPrice || p.current_price || 0;
                  const minStock = p.minimum_stock || p.reorderLevel || 30;

                  const isEditingPrice = inlineEditing?.productId === p.id && inlineEditing?.field === 'currentPrice';
                  const isEditingCost = inlineEditing?.productId === p.id && inlineEditing?.field === 'cost';
                  const isEditingStock = inlineEditing?.productId === p.id && inlineEditing?.field === 'stock';

                  return (
                    <tr
                      key={p.id}
                      className={isSelected ? 'row-selected' : ''}
                      style={{ backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.08)' : undefined }}
                    >
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleProductSelection(p.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>

                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {p.sku} • <span style={{ color: 'var(--text-secondary)' }}>{p.supplier || 'Direct'}</span>
                        </div>
                      </td>

                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {p.category}
                      </td>

                      {/* Inline Editable Selling Price */}
                      <td
                        onDoubleClick={() => startInlineEdit(p.id, 'currentPrice', price)}
                        title="Double click to quick-edit price"
                        style={{ cursor: 'pointer' }}
                      >
                        {isEditingPrice ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <input
                              type="number"
                              step="0.1"
                              autoFocus
                              className="inline-edit-input"
                              value={inlineEditing.value}
                              onChange={(e) => setInlineEditing({ ...inlineEditing, value: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitInlineEdit();
                                if (e.key === 'Escape') cancelInlineEdit();
                              }}
                              onBlur={commitInlineEdit}
                            />
                          </div>
                        ) : (
                          <div className="inline-editable-cell">
                            <span style={{ fontWeight: 700, color: 'var(--primary-light)', fontFamily: 'var(--font-mono)' }}>
                              {formatCurrency(price)}
                            </span>
                            <Edit2 size={11} className="cell-edit-icon" onClick={() => startInlineEdit(p.id, 'currentPrice', price)} />
                          </div>
                        )}
                      </td>

                      {/* Inline Editable Wholesale Cost */}
                      <td
                        onDoubleClick={() => startInlineEdit(p.id, 'cost', cost)}
                        title="Double click to quick-edit cost"
                        style={{ cursor: 'pointer' }}
                      >
                        {isEditingCost ? (
                          <input
                            type="number"
                            step="0.1"
                            autoFocus
                            className="inline-edit-input"
                            value={inlineEditing.value}
                            onChange={(e) => setInlineEditing({ ...inlineEditing, value: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitInlineEdit();
                              if (e.key === 'Escape') cancelInlineEdit();
                            }}
                            onBlur={commitInlineEdit}
                          />
                        ) : (
                          <div className="inline-editable-cell">
                            <span style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>
                              {formatCurrency(cost)}
                            </span>
                            <Edit2 size={11} className="cell-edit-icon" onClick={() => startInlineEdit(p.id, 'cost', cost)} />
                          </div>
                        )}
                      </td>

                      {/* Inline Editable Stock */}
                      <td
                        onDoubleClick={() => startInlineEdit(p.id, 'stock', p.stock)}
                        title="Double click to quick-edit stock"
                        style={{ cursor: 'pointer' }}
                      >
                        {isEditingStock ? (
                          <input
                            type="number"
                            autoFocus
                            className="inline-edit-input"
                            value={inlineEditing.value}
                            onChange={(e) => setInlineEditing({ ...inlineEditing, value: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitInlineEdit();
                              if (e.key === 'Escape') cancelInlineEdit();
                            }}
                            onBlur={commitInlineEdit}
                          />
                        ) : (
                          <div style={{ minWidth: '120px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                              <span
                                style={{
                                  fontWeight: 700,
                                  fontSize: '0.88rem',
                                  fontFamily: 'var(--font-mono)',
                                  color: isCritical ? 'var(--danger)' : isLow ? 'var(--warning)' : 'var(--text-primary)'
                                }}
                              >
                                {p.stock} units
                              </span>
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                Min: {minStock}
                              </span>
                            </div>
                            {/* Live Dynamic Stock Level Progress Bar */}
                            <div style={{ width: '100%', height: '5px', background: 'var(--bg-surface-elevated)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div
                                style={{
                                  height: '100%',
                                  width: `${Math.min(100, Math.max(6, (p.stock / (minStock * 2.5)) * 100))}%`,
                                  background: isCritical ? 'var(--danger)' : isLow ? 'var(--warning)' : 'var(--success)',
                                  borderRadius: '4px',
                                  transition: 'width 0.4s ease'
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </td>

                      <td style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>
                        {minStock} units
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          Safety: {p.safetyStock || Math.round(minStock * 0.4)}
                        </div>
                      </td>

                      <td>
                        <Badge
                          variant={
                            (p.status === 'In Stock' || p.status === 'Optimal') ? 'success' :
                            p.status === 'Low Stock' ? 'warning' :
                            p.status === 'Critical' ? 'danger' : 'info'
                          }
                        >
                          {p.status}
                        </Badge>
                      </td>

                      <td>
                        <div className="table-action-group" style={{ justifyContent: 'flex-end' }}>
                          <button
                            className={`btn btn-sm ${isCritical ? 'btn-danger' : isLow ? 'btn-ai' : 'btn-outline'}`}
                            onClick={() => handleOpenRestock(p)}
                            title="Open supplier replenishment purchase order modal"
                          >
                            <PackagePlus size={14} />
                            <span>Restock</span>
                          </button>

                          <button
                            className="btn-icon-only primary"
                            onClick={() => setEditingProduct(p)}
                            title="Edit product parameters"
                          >
                            <Edit2 size={14} />
                          </button>

                          <button
                            className="btn-icon-only danger"
                            onClick={() => setDeletingProduct(p)}
                            title="Delete SKU"
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

        {/* Pagination Bar */}
        <div className="table-pagination-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            <span>Showing <strong>{filteredProducts.length === 0 ? 0 : (currentPage - 1) * (pageSize === 'all' ? filteredProducts.length : pageSize) + 1}</strong> - <strong>{pageSize === 'all' ? filteredProducts.length : Math.min(currentPage * pageSize, filteredProducts.length)}</strong> of <strong>{filteredProducts.length}</strong> SKUs</span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>Rows per page:</span>
              <select
                className="form-select"
                style={{ width: 'auto', padding: '0.2rem 0.5rem', fontSize: '0.78rem' }}
                value={pageSize}
                onChange={(e) => {
                  setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>

          {pageSize !== 'all' && totalPages > 1 && (
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <button
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.3rem 0.5rem' }}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={14} />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                <button
                  key={pageNum}
                  className={`btn btn-sm ${currentPage === pageNum ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ minWidth: '28px', padding: '0.25rem 0.5rem', fontSize: '0.78rem' }}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              ))}

              <button
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.3rem 0.5rem' }}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Relational Inventory Transaction Ledger */}
      <div className="card-glass" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <History size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Inventory Movement & Restock Ledger</h3>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {inventory.length} transactions recorded
          </span>
        </div>

        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Target SKU</th>
                <th>Transaction Type</th>
                <th>Quantity Delta</th>
                <th>Remaining Balance</th>
                <th>Initiated By / Notes</th>
              </tr>
            </thead>
            <tbody>
              {inventory.slice(0, 15).map((tx) => (
                <tr key={tx.id}>
                  <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {tx.date || (tx.created_at ? String(tx.created_at).replace('T', ' ').substring(0, 16) : '—')}
                  </td>
                  <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{tx.sku}</td>
                  <td>
                    <Badge variant={tx.transaction_type === 'RESTOCK' ? 'success' : tx.transaction_type === 'SALE' ? 'info' : 'warning'}>
                      {tx.transaction_type}
                    </Badge>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: tx.quantity > 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity} units
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {tx.remaining_stock !== undefined ? tx.remaining_stock : (tx.new_stock !== undefined ? tx.new_stock : '—')} units
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <div><strong>{tx.user}</strong></div>
                    {tx.notes && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{tx.notes}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Professional Restock Purchase Order Modal */}
      <Modal
        isOpen={restockModalOpen}
        onClose={() => setRestockModalOpen(false)}
        title={`Trigger Supplier Purchase Order: ${selectedProductForRestock?.name || ''}`}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setRestockModalOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleConfirmRestock}>
              <Truck size={16} />
              <span>Confirm Restock & Dispatch PO</span>
            </button>
          </>
        }
      >
        {selectedProductForRestock && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ padding: '0.85rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', border: '1px solid var(--border-subtle)' }}>
              <div><strong>Selected Product:</strong> {selectedProductForRestock.name}</div>
              <div><strong>SKU:</strong> {selectedProductForRestock.sku}</div>
              <div><strong>Primary Supplier:</strong> {selectedProductForRestock.supplier || 'Primary Vendor'}</div>
              <div><strong>Current Stock:</strong> {selectedProductForRestock.stock} units</div>
              <div><strong>Reorder Point (Minimum Stock):</strong> {selectedProductForRestock.minimum_stock || selectedProductForRestock.reorderLevel} units</div>
              <div><strong>Safety Buffer:</strong> {selectedProductForRestock.safetyStock || Math.round((selectedProductForRestock.minimum_stock || 30) * 0.4)} units</div>
              <div><strong>Supplier Lead Time:</strong> {selectedProductForRestock.leadTimeDays || 7} business days</div>
              <div><strong>Wholesale Unit Cost:</strong> {formatCurrency(selectedProductForRestock.cost || selectedProductForRestock.baseCost)}</div>
            </div>

            <div className="form-group">
              <label className="form-label">
                <span>Order Quantity (Units) <span style={{ color: 'var(--danger)' }}>*</span></span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Enter positive integer</span>
              </label>
              <input
                type="number"
                className={`form-input ${restockError ? 'input-error' : ''}`}
                min="1"
                step="5"
                placeholder="Enter reorder quantity (e.g. 50)"
                value={restockQuantity}
                onChange={(e) => {
                  setRestockQuantity(e.target.value);
                  if (restockError) setRestockError('');
                }}
              />
              {restockError && <span className="field-error-text">{restockError}</span>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.85rem', background: 'rgba(99, 102, 241, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glow)', fontSize: '0.85rem' }}>
              <span>Total Estimated Wholesale PO Cost:</span>
              <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-accent)' }}>
                {formatCurrency((parseInt(restockQuantity, 10) || 0) * (selectedProductForRestock.cost || selectedProductForRestock.baseCost))}
              </strong>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Product Modal */}
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

      {/* Edit Product Modal */}
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

      {/* Delete Confirmation Modal */}
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
