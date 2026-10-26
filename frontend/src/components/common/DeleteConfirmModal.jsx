import React from 'react';
import { Modal } from './Modal';
import { AlertTriangle, Trash2, Package } from 'lucide-react';
import { formatCurrency } from '../../utils/currency';

export const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, product }) => {
  if (!product) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="⚠️ Confirm Permanent Product Deletion"
      maxWidth="500px"
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              onConfirm(product.id);
              onClose();
            }}
          >
            <Trash2 size={16} />
            <span>Delete Product</span>
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '1rem', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius-md)' }}>
          <AlertTriangle size={24} color="var(--danger)" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, color: 'var(--danger)', fontSize: '0.9rem' }}>
              Destructive Action Warning
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Are you sure you want to remove <strong>{product.name}</strong> ({product.sku}) from the catalog? This will delete active pricing optimization models and inventory records.
            </div>
          </div>
        </div>

        <div style={{ padding: '0.85rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>SKU Identifier:</span>
            <strong style={{ fontFamily: 'var(--font-mono)' }}>{product.sku}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Category:</span>
            <span>{product.category}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Current Shelf Price:</span>
            <strong style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(product.currentPrice)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>On-Hand Stock:</span>
            <span>{product.stock} units</span>
          </div>
        </div>
      </div>
    </Modal>
  );
};
