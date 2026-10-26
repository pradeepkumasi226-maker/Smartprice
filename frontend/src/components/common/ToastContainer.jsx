import React from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, RotateCcw, X } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export const ToastContainer = () => {
  const { toasts, removeToast } = useStore();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type || 'info'} animate-slide-in`}>
          {toast.type === 'success' && <CheckCircle size={18} color="var(--success)" style={{ flexShrink: 0 }} />}
          {toast.type === 'error' && <AlertCircle size={18} color="var(--danger)" style={{ flexShrink: 0 }} />}
          {toast.type === 'warning' && <AlertTriangle size={18} color="var(--warning)" style={{ flexShrink: 0 }} />}
          {toast.type === 'info' && <Info size={18} color="var(--info)" style={{ flexShrink: 0 }} />}
          {toast.type === 'undo' && <RotateCcw size={18} color="var(--primary)" style={{ flexShrink: 0 }} />}

          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
              {toast.title}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {toast.message}
            </div>
          </div>

          {toast.action && (
            <button
              className="toast-action-btn"
              onClick={() => {
                toast.action.onClick?.();
                removeToast(toast.id);
              }}
            >
              <RotateCcw size={12} />
              <span>{toast.action.label || 'Undo'}</span>
            </button>
          )}

          <button
            onClick={() => removeToast(toast.id)}
            className="toast-close-btn"
            title="Dismiss toast"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
