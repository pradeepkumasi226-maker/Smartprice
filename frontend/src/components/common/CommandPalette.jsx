import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  LayoutDashboard,
  TrendingUp,
  Sliders,
  Sparkles,
  Boxes,
  BrainCircuit,
  FileBarChart,
  Settings,
  CheckCircle,
  PackagePlus,
  Volume2,
  VolumeX,
  HelpCircle,
  ArrowRight,
  CornerDownLeft,
  X,
  Tag
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { formatCurrency } from '../../utils/currency';

export const CommandPalette = ({ isOpen, onClose }) => {
  const {
    products,
    navigateTo,
    batchApproveAll,
    optimizations,
    soundEnabled,
    toggleSoundEffect,
    toggleShortcutsModal
  } = useStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const navItems = [
    { id: 'nav-dashboard', type: 'Page', title: 'Executive Dashboard', icon: LayoutDashboard, action: () => navigateTo('dashboard') },
    { id: 'nav-optimization', type: 'Page', title: 'Dynamic Price Optimization Matrix', icon: TrendingUp, action: () => navigateTo('optimization') },
    { id: 'nav-whatif', type: 'Page', title: 'What-If Pricing Simulation & Staging', icon: Sliders, action: () => navigateTo('what-if') },
    { id: 'nav-forecast', type: 'Page', title: 'Demand Forecasting & Seasonality', icon: Sparkles, action: () => navigateTo('forecast') },
    { id: 'nav-inventory', type: 'Page', title: 'Inventory & Stock Intelligence', icon: Boxes, action: () => navigateTo('inventory') },
    { id: 'nav-ai', type: 'Page', title: 'Explainable AI & SHAP Transparency Hub', icon: BrainCircuit, action: () => navigateTo('ai-insights') },
    { id: 'nav-reports', type: 'Page', title: 'Retail Financial Audit & Reports', icon: FileBarChart, action: () => navigateTo('reports') },
    { id: 'nav-settings', type: 'Page', title: 'System Configuration & Safety Guardrails', icon: Settings, action: () => navigateTo('settings') },
  ];

  const pendingCount = optimizations.filter(o => o.status === 'Pending Approval').length;

  const quickActions = [
    {
      id: 'act-approve',
      type: 'Action',
      title: `Approve All Pending AI Prices (${pendingCount} pending)`,
      subtitle: 'Activate recommended prices across retail catalog',
      icon: CheckCircle,
      action: () => {
        batchApproveAll();
        onClose();
      }
    },
    {
      id: 'act-new-product',
      type: 'Action',
      title: 'Add New Product to Catalog',
      subtitle: 'Open product creation intake wizard',
      icon: PackagePlus,
      action: () => {
        navigateTo('inventory', { openAdd: true });
        onClose();
      }
    },
    {
      id: 'act-sound',
      type: 'Action',
      title: soundEnabled ? 'Mute Procedural Sound Effects' : 'Enable Procedural Sound Effects',
      subtitle: 'Toggle synthesized Web Audio feedback cues',
      icon: soundEnabled ? VolumeX : Volume2,
      action: () => {
        toggleSoundEffect();
        onClose();
      }
    },
    {
      id: 'act-shortcuts',
      type: 'Action',
      title: 'Show Keyboard Shortcuts Cheat Sheet',
      subtitle: 'View keyboard quick navigation bindings',
      icon: HelpCircle,
      action: () => {
        onClose();
        toggleShortcutsModal();
      }
    }
  ];

  const productItems = products.slice(0, 15).map(p => ({
    id: `prod-${p.id}`,
    type: 'Product',
    title: p.name,
    subtitle: `SKU: ${p.sku} • Price: ${formatCurrency(p.currentPrice)} • Stock: ${p.stock} units`,
    icon: Tag,
    action: () => {
      navigateTo('what-if', { productId: p.id });
      onClose();
    }
  }));

  const allItems = [...navItems, ...quickActions, ...productItems];

  const filteredItems = allItems.filter(item => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    const titleMatch = item.title.toLowerCase().includes(q);
    const subtitleMatch = item.subtitle && item.subtitle.toLowerCase().includes(q);
    const typeMatch = item.type.toLowerCase().includes(q);
    return titleMatch || subtitleMatch || typeMatch;
  });

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  useEffect(() => {
    if (selectedIndex >= filteredItems.length) {
      setSelectedIndex(0);
    }
  }, [filteredItems.length, selectedIndex]);

  useEffect(() => {
    const selectedEl = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="command-palette-backdrop" onClick={onClose}>
      <div
        className="command-palette-container"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Bar */}
        <div className="command-palette-search">
          <Search size={18} className="command-palette-icon" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command, page, product name, or SKU..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              className="command-palette-clear"
              onClick={() => setQuery('')}
              tabIndex={-1}
            >
              <X size={14} />
            </button>
          )}
          <kbd className="command-palette-badge">ESC</kbd>
        </div>

        {/* Results List */}
        <div className="command-palette-list" ref={listRef}>
          {filteredItems.length === 0 ? (
            <div className="command-palette-empty">
              No matching commands, pages, or products found for "{query}".
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  data-index={idx}
                  className={`command-palette-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="item-icon-wrap">
                    <Icon size={16} />
                  </div>
                  <div className="item-content">
                    <div className="item-title-row">
                      <span className="item-title">{item.title}</span>
                      <span className={`item-tag tag-${item.type.toLowerCase()}`}>{item.type}</span>
                    </div>
                    {item.subtitle && <div className="item-subtitle">{item.subtitle}</div>}
                  </div>
                  {isSelected && (
                    <div className="item-enter-hint">
                      <span>Select</span>
                      <CornerDownLeft size={13} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="command-palette-footer">
          <div className="footer-hints">
            <span><kbd>↑</kbd> <kbd>↓</kbd> Navigate</span>
            <span><kbd>↵</kbd> Select</span>
            <span><kbd>ESC</kbd> Close</span>
          </div>
          <div className="footer-brand">SmartPrice Command Hub</div>
        </div>
      </div>
    </div>
  );
};
