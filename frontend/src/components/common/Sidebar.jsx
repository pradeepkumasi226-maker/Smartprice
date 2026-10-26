import React from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  Tag,
  Sliders,
  Boxes,
  BrainCircuit,
  FileBarChart,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Zap,
  LogOut,
  ShoppingBag
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';

export const Sidebar = ({ isCollapsed, setIsCollapsed, isMobileOpen, setIsMobileOpen }) => {
  const { activePage, navigateTo, optimizations, products } = useStore();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigateTo('login', {}, { replace: true });
  };

  const pendingOptimizationsCount = optimizations.filter(o => o.status === 'Pending Approval').length;
  const criticalStockCount = products.filter(p => p.status === 'Critical' || p.status === 'Low Stock').length;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'products', label: 'Products', icon: ShoppingBag },
    { id: 'forecast', label: 'Demand Forecast', icon: TrendingUp },
    {
      id: 'optimization',
      label: 'Price Optimization',
      icon: Tag,
      badge: pendingOptimizationsCount > 0 ? `${pendingOptimizationsCount} New` : null
    },
    { id: 'what-if', label: 'What-If Analysis', icon: Sliders },
    {
      id: 'inventory',
      label: 'Inventory Intelligence',
      icon: Boxes,
      badge: criticalStockCount > 0 ? `${criticalStockCount} Low` : null
    },
    { id: 'ai-insights', label: 'SHAP / AI Insights', icon: BrainCircuit, isAi: true },
    { id: 'reports', label: 'Business Reports', icon: FileBarChart },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];


  const handleNavClick = (id) => {
    navigateTo(id);
    if (isMobileOpen && setIsMobileOpen) {
      setIsMobileOpen(false);
    }
  };

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-header">
        {!isCollapsed ? (
          <div
            className="brand-logo-container"
            onClick={() => handleNavClick('dashboard')}
            style={{ cursor: 'pointer' }}
          >
            <div className="brand-logo-icon">
              <Sparkles size={20} color="var(--primary)" />
            </div>
            <div className="brand-name">
              <span className="brand-title">
                Smart<span>Price</span>
              </span>
              <span className="brand-tagline">Explainable AI Retail</span>
            </div>
          </div>
        ) : (
          <div
            className="brand-logo-icon"
            title="SmartPrice AI"
            onClick={() => handleNavClick('dashboard')}
            style={{ cursor: 'pointer' }}
          >
            <Sparkles size={20} color="var(--primary)" />
          </div>
        )}

        <button
          className="sidebar-toggle-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <div className="sidebar-nav">
        <div className="sidebar-section-title">
          {!isCollapsed ? "Optimization Suite" : "Menu"}
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`nav-item ${isActive ? 'active' : ''}`}
              title={isCollapsed ? item.label : undefined}
            >
              <div className="nav-item-icon">
                <Icon size={19} />
              </div>
              {!isCollapsed && (
                <>
                  <span className="nav-item-label">{item.label}</span>
                  {item.badge && (
                    <span className={`nav-item-badge ${item.id === 'inventory' ? 'badge-warning-soft' : ''}`}>
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>

      <div className="sidebar-footer">
        {!isCollapsed ? (
          <div className="ai-engine-status">
            <div className="ai-status-indicator animate-pulse-glow" />
            <div className="ai-status-text">
              <span className="ai-status-title">XAI Pricing Engine</span>
              <span className="ai-status-subtitle">Attribution Engine Active</span>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div className="ai-status-indicator animate-pulse-glow" title="AI Model Active" />
          </div>
        )}

        <button
          className="nav-item"
          onClick={handleLogout}
          title="Sign Out"
          style={{
            marginTop: '0.5rem',
            width: '100%',
            color: 'var(--text-muted)',
            transition: 'color 0.2s, background 0.2s',
            borderTop: '1px solid var(--border-subtle)',
            borderRadius: 0,
            paddingTop: '0.75rem'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          <div className="nav-item-icon">
            <LogOut size={17} />
          </div>
          {!isCollapsed && <span className="nav-item-label">Sign Out</span>}
        </button>
      </div>
    </aside>
  );
};
