import React, { useState } from 'react';
import {
  Sparkles,
  Trash2,
  X,
  CheckSquare,
  RefreshCw,
  Download,
  Percent,
  DollarSign,
  Boxes,
  Layers,
  ChevronDown
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export const BatchActionToolbar = ({
  selectedIds,
  onClear,
  onBatchOptimize,
  onBatchDelete
}) => {
  const {
    products,
    batchAdjustPrice,
    batchRestock,
    batchUpdateCategory,
    addToast
  } = useStore();

  const [activeDropdown, setActiveDropdown] = useState(null); // 'price' | 'restock' | 'category'
  const [customPriceVal, setCustomPriceVal] = useState('');
  const [customPriceType, setCustomPriceType] = useState('percent'); // 'percent' | 'fixed'

  if (!selectedIds || selectedIds.length === 0) return null;

  const handleExportSelected = () => {
    const selectedProducts = products.filter(p => selectedIds.includes(p.id));
    const csvHeader = 'ID,SKU,Name,Category,Current Price,Base Cost,Stock,Status,Supplier\n';
    const csvRows = selectedProducts.map(p =>
      `"${p.id}","${p.sku}","${p.name.replace(/"/g, '""')}","${p.category}",${p.currentPrice},${p.cost || p.baseCost},${p.stock},"${p.status}","${p.supplier || ''}"`
    ).join('\n');

    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `smartprice_batch_export_${selectedIds.length}_items.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast(
      "Batch Export Downloaded",
      `Exported ${selectedIds.length} items to CSV.`,
      "success"
    );
  };

  const categories = [
    'Electronics',
    'Apparel',
    'Home & Kitchen',
    'Groceries',
    'Health & Beauty',
    'Sports & Outdoors'
  ];

  return (
    <div className="batch-action-toolbar animate-fade-in">
      <div className="batch-toolbar-info">
        <CheckSquare size={18} color="var(--primary)" />
        <span><strong>{selectedIds.length}</strong> product{selectedIds.length > 1 ? 's' : ''} selected</span>
      </div>

      <div className="batch-toolbar-actions" style={{ position: 'relative' }}>
        {/* Batch Price Adjust Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            className={`btn btn-secondary btn-sm ${activeDropdown === 'price' ? 'active' : ''}`}
            onClick={() => setActiveDropdown(prev => prev === 'price' ? null : 'price')}
            title="Adjust price for selected products"
          >
            <Percent size={14} />
            <span>Price Shift</span>
            <ChevronDown size={12} />
          </button>

          {activeDropdown === 'price' && (
            <div className="batch-popover-menu card-glass">
              <div className="popover-title">Batch Adjust Prices</div>
              <div className="quick-chip-row">
                <button className="chip-btn" onClick={() => { batchAdjustPrice(selectedIds, { type: 'percent', value: 5 }); setActiveDropdown(null); }}>+5%</button>
                <button className="chip-btn" onClick={() => { batchAdjustPrice(selectedIds, { type: 'percent', value: 10 }); setActiveDropdown(null); }}>+10%</button>
                <button className="chip-btn" onClick={() => { batchAdjustPrice(selectedIds, { type: 'percent', value: -5 }); setActiveDropdown(null); }}>-5%</button>
                <button className="chip-btn" onClick={() => { batchAdjustPrice(selectedIds, { type: 'percent', value: -10 }); setActiveDropdown(null); }}>-10%</button>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
                <select
                  className="form-select"
                  style={{ width: '80px', padding: '0.25rem 0.4rem', fontSize: '0.75rem' }}
                  value={customPriceType}
                  onChange={(e) => setCustomPriceType(e.target.value)}
                >
                  <option value="percent">% Delta</option>
                  <option value="fixed">₹ Shift</option>
                </select>
                <input
                  type="number"
                  placeholder={customPriceType === 'percent' ? '+5 or -5' : '+2.00'}
                  value={customPriceVal}
                  onChange={(e) => setCustomPriceVal(e.target.value)}
                  style={{ flex: 1, padding: '0.25rem 0.4rem', fontSize: '0.75rem', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '4px', color: 'var(--text-primary)' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customPriceVal) {
                      batchAdjustPrice(selectedIds, { type: customPriceType, value: Number(customPriceVal) });
                      setCustomPriceVal('');
                      setActiveDropdown(null);
                    }
                  }}
                />
                <button
                  className="btn btn-primary btn-sm"
                  style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                  onClick={() => {
                    if (customPriceVal) {
                      batchAdjustPrice(selectedIds, { type: customPriceType, value: Number(customPriceVal) });
                      setCustomPriceVal('');
                      setActiveDropdown(null);
                    }
                  }}
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Batch Restock Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            className={`btn btn-secondary btn-sm ${activeDropdown === 'restock' ? 'active' : ''}`}
            onClick={() => setActiveDropdown(prev => prev === 'restock' ? null : 'restock')}
            title="Batch restock selected products"
          >
            <Boxes size={14} />
            <span>Restock</span>
            <ChevronDown size={12} />
          </button>

          {activeDropdown === 'restock' && (
            <div className="batch-popover-menu card-glass">
              <div className="popover-title">Batch Restock Quantity</div>
              <div className="quick-chip-row">
                <button className="chip-btn" onClick={() => { batchRestock(selectedIds, 25); setActiveDropdown(null); }}>+25 units</button>
                <button className="chip-btn" onClick={() => { batchRestock(selectedIds, 50); setActiveDropdown(null); }}>+50 units</button>
                <button className="chip-btn" onClick={() => { batchRestock(selectedIds, 100); setActiveDropdown(null); }}>+100 units</button>
              </div>
            </div>
          )}
        </div>

        {/* Batch Category Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            className={`btn btn-secondary btn-sm ${activeDropdown === 'category' ? 'active' : ''}`}
            onClick={() => setActiveDropdown(prev => prev === 'category' ? null : 'category')}
            title="Batch reassign category"
          >
            <Layers size={14} />
            <span>Category</span>
            <ChevronDown size={12} />
          </button>

          {activeDropdown === 'category' && (
            <div className="batch-popover-menu card-glass" style={{ width: '180px' }}>
              <div className="popover-title">Reassign Category</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    className="menu-option-btn"
                    onClick={() => {
                      batchUpdateCategory(selectedIds, cat);
                      setActiveDropdown(null);
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Apply AI Prices */}
        <button
          className="btn btn-ai btn-sm"
          onClick={onBatchOptimize}
          title="Apply AI optimal recommended pricing to all selected products"
        >
          <Sparkles size={14} />
          <span>Apply AI Prices</span>
        </button>

        {/* Export CSV */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleExportSelected}
          title="Export selected rows as CSV"
        >
          <Download size={14} />
          <span>Export CSV</span>
        </button>

        {/* Batch Delete */}
        <button
          className="btn btn-danger btn-sm"
          onClick={onBatchDelete}
          title="Delete selected products"
        >
          <Trash2 size={14} />
          <span>Delete ({selectedIds.length})</span>
        </button>

        <button
          className="btn btn-ghost btn-sm"
          onClick={onClear}
          title="Deselect all products"
          style={{ padding: '0.4rem' }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
