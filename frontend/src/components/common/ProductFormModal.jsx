import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Sparkles, AlertCircle, CheckCircle2, DollarSign, Package, Tag, Layers, HelpCircle, Truck } from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import { mockCategories } from '../../data/mockProducts';

export const ProductFormModal = ({ isOpen, onClose, onSubmit, initialProduct = null, mode = 'add' }) => {
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: 'Electronics',
    supplier: '',
    cost: '',
    current_price: '',
    recommendedPrice: '',
    minPrice: '',
    maxPrice: '',
    competitorPrice: '',
    stock: '',
    minimum_stock: '30',
    safetyStock: '15',
    leadTimeDays: '7',
    elasticity: '-1.25'
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  useEffect(() => {
    if (initialProduct && mode === 'edit') {
      setFormData({
        name: initialProduct.name || '',
        sku: initialProduct.sku || '',
        category: initialProduct.category || 'Electronics',
        supplier: initialProduct.supplier || '',
        cost: String(initialProduct.cost_price !== undefined ? initialProduct.cost_price : (initialProduct.cost !== undefined ? initialProduct.cost : (initialProduct.baseCost ?? ''))),
        current_price: String(initialProduct.current_price !== undefined ? initialProduct.current_price : (initialProduct.currentPrice ?? '')),
        recommendedPrice: String(initialProduct.recommended_price !== undefined ? initialProduct.recommended_price : (initialProduct.recommendedPrice ?? '')),
        minPrice: String(initialProduct.minPrice || ''),
        maxPrice: String(initialProduct.maxPrice || ''),
        competitorPrice: String(initialProduct.competitor_price !== undefined ? initialProduct.competitor_price : (initialProduct.competitorPrice ?? '')),
        stock: String(initialProduct.stock_quantity !== undefined ? initialProduct.stock_quantity : (initialProduct.stock ?? '')),
        minimum_stock: String(initialProduct.reorder_level !== undefined ? initialProduct.reorder_level : (initialProduct.minimum_stock !== undefined ? initialProduct.minimum_stock : (initialProduct.reorderLevel ?? '30'))),
        safetyStock: String(initialProduct.safety_stock !== undefined ? initialProduct.safety_stock : (initialProduct.safetyStock ?? '15')),
        leadTimeDays: String(initialProduct.leadTimeDays || '7'),
        elasticity: String(initialProduct.elasticity || '-1.25')
      });
    } else if (mode === 'add') {
      setFormData({
        name: '',
        sku: '',
        category: 'Electronics',
        supplier: 'Global Direct Logistics Ltd.',
        cost: '',
        current_price: '',
        recommendedPrice: '',
        minPrice: '',
        maxPrice: '',
        competitorPrice: '',
        stock: '',
        minimum_stock: '30',
        safetyStock: '15',
        leadTimeDays: '7',
        elasticity: '-1.25'
      });
    }
    setErrors({});
    setTouched({});
  }, [initialProduct, mode, isOpen]);

  const validate = (data) => {
    const errs = {};
    if (!data.name || data.name.trim().length < 3) {
      errs.name = 'Product name must be at least 3 characters.';
    }

    if (!data.sku || data.sku.trim().length < 3) {
      errs.sku = 'SKU is required (e.g., ELC-1020).';
    }

    const c = parseFloat(data.cost);
    if (isNaN(c) || c <= 0) {
      errs.cost = 'Product cost (COGS) must be greater than 0.';
    }

    const price = parseFloat(data.current_price);
    if (isNaN(price) || price <= 0) {
      errs.current_price = 'Current selling price must be greater than 0.';
    } else if (!isNaN(c) && price < c) {
      errs.current_price = 'Selling price cannot be lower than wholesale cost.';
    }

    const minP = parseFloat(data.minPrice);
    const maxP = parseFloat(data.maxPrice);
    if (!isNaN(minP) && !isNaN(price) && minP > price) {
      errs.minPrice = 'Min guardrail cannot exceed current price.';
    }
    if (!isNaN(maxP) && !isNaN(price) && maxP < price) {
      errs.maxPrice = 'Max guardrail cannot be lower than current price.';
    }
    if (!isNaN(minP) && !isNaN(maxP) && minP > maxP) {
      errs.minPrice = 'Min guardrail cannot exceed max guardrail.';
    }

    const compPrice = parseFloat(data.competitorPrice);
    if (isNaN(compPrice) || compPrice <= 0) {
      errs.competitorPrice = 'Competitor benchmark price is required.';
    }

    const stockVal = parseInt(data.stock, 10);
    if (isNaN(stockVal) || stockVal < 0) {
      errs.stock = 'Stock must be 0 or higher.';
    }

    const elast = parseFloat(data.elasticity);
    if (isNaN(elast) || elast > 0 || elast < -5) {
      errs.elasticity = 'Elasticity must be negative (between -5.00 and 0.00).';
    }

    return errs;
  };

  const handleChange = (field, value) => {
    const updated = { ...formData, [field]: value };
    
    if (field === 'current_price' || field === 'cost' || field === 'competitorPrice') {
      const p = parseFloat(field === 'current_price' ? value : updated.current_price);
      const c = parseFloat(field === 'cost' ? value : updated.cost);
      const comp = parseFloat(field === 'competitorPrice' ? value : updated.competitorPrice);
      
      if (!isNaN(p) && p > 0) {
        if (!updated.minPrice || mode === 'add') updated.minPrice = (p * 0.8).toFixed(2);
        if (!updated.maxPrice || mode === 'add') updated.maxPrice = (p * 1.3).toFixed(2);
        if (!updated.recommendedPrice || mode === 'add') {
          const rec = !isNaN(comp) && comp > 0 ? (p * 0.5 + comp * 0.55).toFixed(2) : (p * 1.08).toFixed(2);
          updated.recommendedPrice = rec;
        }
      }
    }

    setFormData(updated);
    if (touched[field]) {
      setErrors(validate(updated));
    }
  };

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    setErrors(validate(formData));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validate(formData);
    setErrors(validationErrors);
    setTouched({
      name: true,
      sku: true,
      category: true,
      cost: true,
      current_price: true,
      competitorPrice: true,
      stock: true,
      elasticity: true
    });

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    const c = parseFloat(formData.cost);
    const p = parseFloat(formData.current_price);
    const recPrice = parseFloat(formData.recommendedPrice) || p;
    const minP = parseFloat(formData.minPrice) || (p * 0.8);
    const maxP = parseFloat(formData.maxPrice) || (p * 1.3);
    const compP = parseFloat(formData.competitorPrice) || p;
    const stockVal = parseInt(formData.stock, 10);
    const minStock = parseInt(formData.minimum_stock, 10) || 30;
    const safetyVal = parseInt(formData.safetyStock, 10) || Math.round(minStock * 0.4);
    const leadVal = parseInt(formData.leadTimeDays, 10) || 7;
    const elastVal = parseFloat(formData.elasticity) || -1.25;

    const payload = {
      name: formData.name.trim(),
      sku: formData.sku.trim().toUpperCase(),
      category: formData.category,
      supplier: formData.supplier.trim() || 'Global Direct Vendor Ltd.',
      cost: c,
      baseCost: c,
      current_price: p,
      currentPrice: p,
      recommendedPrice: recPrice,
      minPrice: minP,
      maxPrice: maxP,
      competitorPrice: compP,
      stock: stockVal,
      minimum_stock: minStock,
      reorderLevel: minStock,
      safetyStock: safetyVal,
      leadTimeDays: leadVal,
      elasticity: elastVal,
      predictedDemand: Math.round(150 + Math.random() * 250)
    };

    onSubmit(payload);
    onClose();
  };

  const numPrice = parseFloat(formData.current_price);
  const numCost = parseFloat(formData.cost);
  const marginPercent = !isNaN(numPrice) && !isNaN(numCost) && numPrice > 0
    ? (((numPrice - numCost) / numPrice) * 100).toFixed(1)
    : '0.0';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'add' ? '✨ Add New Product & Configure Supply Chain' : `✏️ Edit Product: ${initialProduct?.sku || ''}`}
      maxWidth="740px"
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit}>
            {mode === 'add' ? 'Save & Record Initial Inventory' : 'Update Product Attributes'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
        {/* Basic Info */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">
              Product Title / Name <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              className={`form-input ${errors.name && touched.name ? 'input-error' : ''}`}
              placeholder="e.g. Smart Noise-Cancelling Headphones Pro"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              onBlur={() => handleBlur('name')}
            />
            {errors.name && touched.name && <span className="field-error-text">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">
              SKU Code <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              className={`form-input ${errors.sku && touched.sku ? 'input-error' : ''}`}
              placeholder="e.g. ELC-9901"
              value={formData.sku}
              onChange={(e) => handleChange('sku', e.target.value)}
              onBlur={() => handleBlur('sku')}
            />
            {errors.sku && touched.sku && <span className="field-error-text">{errors.sku}</span>}
          </div>
        </div>

        {/* Category & Supplier */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Department / Category</label>
            <select
              className="form-select"
              value={formData.category}
              onChange={(e) => handleChange('category', e.target.value)}
            >
              {mockCategories.filter(c => c !== 'All Categories').map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Supplier / Primary Vendor</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g., AudioTech Global Dynamics Ltd."
              value={formData.supplier}
              onChange={(e) => handleChange('supplier', e.target.value)}
            />
          </div>
        </div>

        {/* Pricing Matrix */}
        <div style={{ padding: '1rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Pricing & Cost Matrix
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-accent)' }}>
              Gross Profit Margin: <strong>{marginPercent}%</strong>
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Product Cost (COGS) <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input
                type="number"
                step="0.01"
                min="0"
                className={`form-input ${errors.cost && touched.cost ? 'input-error' : ''}`}
                placeholder="0.00"
                value={formData.cost}
                onChange={(e) => handleChange('cost', e.target.value)}
                onBlur={() => handleBlur('cost')}
              />
              {errors.cost && touched.cost && <span className="field-error-text">{errors.cost}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Current Selling Price <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input
                type="number"
                step="0.01"
                min="0"
                className={`form-input ${errors.current_price && touched.current_price ? 'input-error' : ''}`}
                placeholder="0.00"
                value={formData.current_price}
                onChange={(e) => handleChange('current_price', e.target.value)}
                onBlur={() => handleBlur('current_price')}
              />
              {errors.current_price && touched.current_price && <span className="field-error-text">{errors.current_price}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Competitor Benchmark <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input
                type="number"
                step="0.01"
                min="0"
                className={`form-input ${errors.competitorPrice && touched.competitorPrice ? 'input-error' : ''}`}
                placeholder="0.00"
                value={formData.competitorPrice}
                onChange={(e) => handleChange('competitorPrice', e.target.value)}
                onBlur={() => handleBlur('competitorPrice')}
              />
              {errors.competitorPrice && touched.competitorPrice && <span className="field-error-text">{errors.competitorPrice}</span>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">AI Recommended Price</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={formData.recommendedPrice}
                onChange={(e) => handleChange('recommendedPrice', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Min Guardrail Floor</label>
              <input
                type="number"
                step="0.01"
                className={`form-input ${errors.minPrice && touched.minPrice ? 'input-error' : ''}`}
                value={formData.minPrice}
                onChange={(e) => handleChange('minPrice', e.target.value)}
                onBlur={() => handleBlur('minPrice')}
              />
              {errors.minPrice && touched.minPrice && <span className="field-error-text">{errors.minPrice}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Max Guardrail Ceiling</label>
              <input
                type="number"
                step="0.01"
                className={`form-input ${errors.maxPrice && touched.maxPrice ? 'input-error' : ''}`}
                value={formData.maxPrice}
                onChange={(e) => handleChange('maxPrice', e.target.value)}
                onBlur={() => handleBlur('maxPrice')}
              />
              {errors.maxPrice && touched.maxPrice && <span className="field-error-text">{errors.maxPrice}</span>}
            </div>
          </div>
        </div>

        {/* Inventory & Elasticity Parameters */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem' }}>
          <div className="form-group">
            <label className="form-label">Initial Stock <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              type="number"
              min="0"
              className={`form-input ${errors.stock && touched.stock ? 'input-error' : ''}`}
              value={formData.stock}
              onChange={(e) => handleChange('stock', e.target.value)}
              onBlur={() => handleBlur('stock')}
            />
            {errors.stock && touched.stock && <span className="field-error-text">{errors.stock}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Minimum Stock (Reorder)</label>
            <input
              type="number"
              min="1"
              className="form-input"
              value={formData.minimum_stock}
              onChange={(e) => handleChange('minimum_stock', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Lead Time (Days)</label>
            <input
              type="number"
              min="1"
              className="form-input"
              value={formData.leadTimeDays}
              onChange={(e) => handleChange('leadTimeDays', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Elasticity (&epsilon;)</label>
            <input
              type="number"
              step="0.05"
              max="0"
              min="-5"
              className={`form-input ${errors.elasticity && touched.elasticity ? 'input-error' : ''}`}
              value={formData.elasticity}
              onChange={(e) => handleChange('elasticity', e.target.value)}
              onBlur={() => handleBlur('elasticity')}
            />
            {errors.elasticity && touched.elasticity && <span className="field-error-text">{errors.elasticity}</span>}
          </div>
        </div>
      </form>
    </Modal>
  );
};
