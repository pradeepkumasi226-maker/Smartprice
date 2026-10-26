import React from 'react';
import {
  Keyboard,
  X,
  Sliders,
  TrendingUp,
  Boxes,
  Sparkles,
  CheckCircle2,
  FileSpreadsheet,
  Zap,
  RotateCcw
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export const KeyboardShortcutsModal = ({ isOpen, onClose }) => {
  const { toggleShortcutsModal } = useStore();

  if (!isOpen) return null;

  const shortcutGroups = [
    {
      title: 'Global Navigation',
      shortcuts: [
        { keys: ['⌘', 'K'], desc: 'Open Command Palette & Global Search' },
        { keys: ['Ctrl', 'K'], desc: 'Open Command Palette (Windows/Linux)' },
        { keys: ['?'], desc: 'Show this keyboard shortcuts cheat sheet' },
        { keys: ['Esc'], desc: 'Dismiss active modal, dropdown, or palette' },
      ]
    },
    {
      title: 'Direct Page Navigation',
      shortcuts: [
        { keys: ['1'], desc: 'Executive Dashboard' },
        { keys: ['2'], desc: 'Demand Forecasting & Seasonality' },
        { keys: ['3'], desc: 'Dynamic Price Optimization Matrix' },
        { keys: ['4'], desc: 'What-If Simulation & Scenarios' },
        { keys: ['5'], desc: 'Inventory & Stock Intelligence' },
        { keys: ['6'], desc: 'Explainable AI & SHAP Insights' },
        { keys: ['7'], desc: 'Retail Financial Audit Reports' },
        { keys: ['8'], desc: 'System Configuration & Guardrails' },
      ]
    },
    {
      title: 'Data Table & Catalog Operations',
      shortcuts: [
        { keys: ['Double-Click'], desc: 'Inline edit Price, Cost, or Stock cell in table' },
        { keys: ['↵ Enter'], desc: 'Commit and save inline edit' },
        { keys: ['Esc'], desc: 'Cancel inline edit without saving' },
        { keys: ['⌘', 'Z'], desc: 'Revert last edit or batch action (Undo)' },
      ]
    }
  ];

  return (
    <div className="command-palette-backdrop" onClick={onClose}>
      <div
        className="shortcuts-modal-container card-glass"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shortcuts-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Keyboard size={20} color="var(--primary)" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Keyboard Shortcuts Cheat Sheet</h3>
          </div>
          <button className="header-action-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="shortcuts-modal-body">
          {shortcutGroups.map((group, gIdx) => (
            <div key={gIdx} className="shortcut-group">
              <h4 className="shortcut-group-title">{group.title}</h4>
              <div className="shortcut-items-grid">
                {group.shortcuts.map((sc, sIdx) => (
                  <div key={sIdx} className="shortcut-row">
                    <span className="shortcut-desc">{sc.desc}</span>
                    <div className="shortcut-keys">
                      {sc.keys.map((k, kIdx) => (
                        <kbd key={kIdx} className="key-badge">{k}</kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="shortcuts-modal-footer">
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Press <kbd className="key-badge">?</kbd> anytime to bring up this cheatsheet.
          </span>
          <button className="btn btn-primary btn-sm" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
