import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Bell,
  Store,
  ChevronDown,
  Menu,
  Sparkles,
  LogOut,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  Volume2,
  VolumeX,
  Keyboard,
  RotateCcw,
  Command,
  KeyRound
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { ChangePasswordModal } from './ChangePasswordModal';

export const Header = ({ onMobileMenuToggle }) => {
  const {
    activePage,
    searchQuery,
    setSearchQuery,
    selectedStore,
    setSelectedStore,
    alerts,
    dismissAlert,
    navigateTo,
    soundEnabled,
    toggleSoundEffect,
    toggleCommandPalette,
    toggleShortcutsModal,
    undoStack,
    undoLastAction,
    isOfflineMode
  } = useStore();

  const { user, logout } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const notifRef = useRef(null);
  const userMenuRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getPageTitle = (id) => {
    switch (id) {
      case 'dashboard': return 'Executive Dashboard';
      case 'forecast': return 'Demand Forecasting & Trends';
      case 'optimization': return 'Dynamic Price Optimization';
      case 'what-if': return 'What-If Pricing Simulation';
      case 'inventory': return 'Inventory & Stock Intelligence';
      case 'ai-insights': return 'Explainable AI & SHAP Insights';
      case 'reports': return 'Retail Performance & Reports';
      case 'settings': return 'System Configuration & Guardrails';
      default: return 'Retail Overview';
    }
  };

  return (
    <header className="top-header">
      <div className="header-left">
        <button
          className="header-action-btn mobile-menu-toggle"
          onClick={onMobileMenuToggle}
          id="mobile-menu-btn"
          title="Toggle navigation sidebar"
        >
          <Menu size={18} />
        </button>

        <div className="page-breadcrumb">
          <span
            onClick={() => navigateTo('dashboard')}
            style={{ cursor: 'pointer', transition: 'color 0.2s' }}
            title="Go to Dashboard"
          >
            SmartPrice
          </span>
          <span>/</span>
          <span className="current">{getPageTitle(activePage)}</span>
        </div>

        <div className="header-search" onClick={() => toggleCommandPalette()} style={{ cursor: 'pointer' }}>
          <Search size={15} className="header-search-icon" />
          <input
            type="text"
            placeholder="Search commands, SKU, products... (⌘K)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            readOnly
            style={{ cursor: 'pointer' }}
          />
          <kbd className="header-cmd-badge" title="Press Ctrl+K or Cmd+K to open Command Palette">
            ⌘K
          </kbd>
        </div>
      </div>

      <div className="header-right">
        {/* Global Disconnected / Offline Indicator */}
        {isOfflineMode && (
          <div
            className="offline-status-badge"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.25rem 0.75rem',
              borderRadius: 'var(--radius-full, 9999px)',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: 'var(--danger, #ef4444)',
              fontSize: '0.74rem',
              fontWeight: 600,
              letterSpacing: '0.01em'
            }}
            title="Backend API is disconnected. Operating in offline demonstration mode."
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: 'var(--danger, #ef4444)',
                boxShadow: '0 0 6px rgba(239, 68, 68, 0.6)',
                display: 'inline-block'
              }}
            />
            <span>Offline Mode</span>
          </div>
        )}

        {/* Store branch selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Store size={15} color="var(--text-muted)" />
          <select
            className="store-selector"
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
          >
            <option value="all">All Retail Outlets (Chain-wide)</option>
            <option value="store-101">Downtown Flagship (Store #101)</option>
            <option value="store-102">Westside Megastore (Store #102)</option>
            <option value="store-103">Airport Terminal Hub (Store #103)</option>
            <option value="online">E-Commerce Web Portal</option>
          </select>
        </div>

        {/* Undo Action Button (Active when history exists) */}
        {undoStack && undoStack.length > 0 && (
          <button
            className="header-action-btn undo-action-pulse"
            onClick={undoLastAction}
            title={`Undo last action: ${undoStack[0]?.description}`}
          >
            <RotateCcw size={16} color="var(--primary)" />
            <span className="undo-counter-badge">{undoStack.length}</span>
          </button>
        )}

        {/* Sound Toggle Button */}
        <button
          className={`header-action-btn ${soundEnabled ? 'sound-active' : ''}`}
          onClick={toggleSoundEffect}
          title={soundEnabled ? 'Audio feedback active (Click to mute)' : 'Audio feedback muted (Click to enable)'}
        >
          {soundEnabled ? <Volume2 size={17} color="var(--primary)" /> : <VolumeX size={17} />}
        </button>

        {/* Keyboard Shortcuts Cheat Sheet Button */}
        <button
          className="header-action-btn"
          onClick={toggleShortcutsModal}
          title="Keyboard Shortcuts (?)"
        >
          <Keyboard size={17} />
        </button>

        {/* Notifications */}
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button
            className="header-action-btn"
            onClick={() => setShowNotifications(!showNotifications)}
            title="System Alerts & Recommendations"
          >
            <Bell size={17} />
            {alerts && alerts.length > 0 && <span className="notification-badge" />}
          </button>

          {showNotifications && (
            <div
              className="card-glass animate-scale-up"
              style={{
                position: 'absolute',
                top: '115%',
                right: 0,
                width: '360px',
                zIndex: 50,
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                boxShadow: 'var(--shadow-xl)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>AI Alerts & Anomalies</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{alerts.length} active</span>
              </div>

              {alerts.length === 0 ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                  No active alerts. All systems running normally.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '280px', overflowY: 'auto' }}>
                  {alerts.map(a => (
                    <div
                      key={a.id}
                      style={{
                        padding: '0.65rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--bg-surface)',
                        fontSize: '0.78rem',
                        display: 'flex',
                        gap: '0.6rem',
                        alignItems: 'flex-start',
                        border: '1px solid var(--border-subtle)'
                      }}
                    >
                      {a.type === 'danger' && <AlertTriangle size={15} color="var(--danger)" style={{ flexShrink: 0, marginTop: '2px' }} />}
                      {a.type === 'warning' && <AlertTriangle size={15} color="var(--warning)" style={{ flexShrink: 0, marginTop: '2px' }} />}
                      {a.type === 'info' && <Info size={15} color="var(--info)" style={{ flexShrink: 0, marginTop: '2px' }} />}
                      
                      <div
                        style={{ flex: 1, cursor: 'pointer' }}
                        onClick={() => {
                          setShowNotifications(false);
                          if (a.targetPage) navigateTo(a.targetPage);
                        }}
                      >
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{a.title}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.74rem', marginTop: '2px' }}>{a.message}</div>
                        <div style={{ color: 'var(--primary)', fontSize: '0.7rem', marginTop: '4px', fontWeight: 600 }}>{a.linkText} →</div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissAlert(a.id);
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                        title="Dismiss alert"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Profile */}
        <div style={{ position: 'relative' }} ref={userMenuRef}>
          <div
            className="user-profile-menu"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <div className="user-avatar">
              {user ? user.name.charAt(0) : 'P'}
            </div>
            <div className="user-info-text">
              <span className="user-name">{user ? user.name : 'Pradeep K'}</span>
              <span className="user-role">{user ? user.role : 'Retail Pricing Manager'}</span>
            </div>
            <ChevronDown size={14} color="var(--text-muted)" />
          </div>

          {showUserMenu && (
            <div
              className="card-glass animate-scale-up"
              style={{
                position: 'absolute',
                top: '115%',
                right: 0,
                width: '220px',
                zIndex: 50,
                padding: '0.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                boxShadow: 'var(--shadow-xl)'
              }}
            >
              <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-subtle)', marginBottom: '0.25rem' }}>
                <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{user?.email || 'pradeep.retail@smartprice.ai'}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-accent)' }}>{user?.store || 'Flagship #104'}</div>
              </div>

              <button
                className="settings-nav-item"
                style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}
                onClick={() => { setShowUserMenu(false); navigateTo('settings'); }}
              >
                Account Settings
              </button>

              <button
                className="settings-nav-item"
                style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                onClick={() => {
                  setShowUserMenu(false);
                  setIsChangePasswordOpen(true);
                }}
              >
                <KeyRound size={14} color="var(--primary)" />
                <span>Change Password</span>
              </button>

              <button
                className="settings-nav-item"
                style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem', color: 'var(--danger)' }}
                onClick={() => {
                  setShowUserMenu(false);
                  logout();
                  navigateTo('login', {}, { replace: true });
                }}
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </header>
  );
};
