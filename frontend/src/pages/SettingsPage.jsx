import React, { useState } from 'react';
import {
  Settings,
  Shield,
  Cpu,
  Store,
  Bell,
  Save,
  RotateCcw,
  CheckCircle2,
  Lock,
  Percent,
  Sliders,
  DollarSign,
  Sun,
  Moon,
  Palette,
  Eye,
  EyeOff,
  AlertCircle,
  KeyRound,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/common/Badge';

// ─── Persistence helpers (mirrors StoreContext pattern) ────────────────────────
const SETTINGS_KEY = 'smartprice_settings';

/** Load the full settings object from localStorage once. */
const loadSettings = () => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw !== null) return JSON.parse(raw);
  } catch (e) {
    console.error('[SettingsPage] Failed to load settings from localStorage:', e);
  }
  return null;
};

/** Persist the full settings object to localStorage. */
const persistSettings = (settings) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('[SettingsPage] Failed to persist settings to localStorage:', e);
    throw e; // re-throw so handleSave can show an error toast
  }
};

// ─── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULTS = {
  minMargin: 25,
  maxPriceChange: 20,
  competitorMatchBuffer: 3.5,
  requireHumanApproval: true,
  modelConfidenceFloor: 85,
  shapDepth: 'Full Additive (5 Factors)',
  retrainFrequency: 'Daily at 02:00 AM',
  emailAlerts: true,
  stockoutAlerts: true,
  competitorPriceDrops: true,
  storeLocation: 'Downtown Flagship (Store #104), Metro Zone',
};

export const SettingsPage = () => {
  const { addToast, currency, setCurrency, settings: storeSettings, updateSettings } = useStore();
  const { theme, setTheme } = useTheme();
  const { user, changePassword } = useAuth();
  const [activeTab, setActiveTab] = useState('guardrails');

  // Security & Password state
  const [secCurrentPassword, setSecCurrentPassword] = useState('');
  const [secNewPassword, setSecNewPassword] = useState('');
  const [secConfirmPassword, setSecConfirmPassword] = useState('');
  const [showSecCurrent, setShowSecCurrent] = useState(false);
  const [showSecNew, setShowSecNew] = useState(false);
  const [secLoading, setSecLoading] = useState(false);
  const [secError, setSecError] = useState('');
  const [secSuccess, setSecSuccess] = useState('');

  const handleSecuritySave = async (e) => {
    e.preventDefault();
    setSecError('');
    setSecSuccess('');

    if (!secCurrentPassword) {
      setSecError('Current password is required.');
      return;
    }
    if (secNewPassword.length < 8) {
      setSecError('New password must be at least 8 characters long.');
      return;
    }
    const hasLetter = /[a-zA-Z]/.test(secNewPassword);
    const hasDigitOrSpecial = /[0-9]|[^a-zA-Z0-9]/.test(secNewPassword);
    if (!hasLetter || !hasDigitOrSpecial) {
      setSecError('New password must contain at least one letter and at least one number or symbol.');
      return;
    }
    if (secNewPassword !== secConfirmPassword) {
      setSecError('New password and confirmation password do not match.');
      return;
    }
    if (secCurrentPassword === secNewPassword) {
      setSecError('New password cannot be identical to your current password.');
      return;
    }

    setSecLoading(true);
    try {
      const res = await changePassword(secCurrentPassword, secNewPassword, secConfirmPassword);
      setSecSuccess(res?.message || 'Password changed successfully! All prior sessions have been revoked.');
      setSecCurrentPassword('');
      setSecNewPassword('');
      setSecConfirmPassword('');
      if (addToast) addToast('Security Updated', 'Your password was changed and prior sessions revoked.', 'success');
    } catch (err) {
      setSecError(err?.message || 'Failed to update password.');
      if (addToast) addToast('Update Failed', err?.message || 'Failed to update password.', 'danger');
    } finally {
      setSecLoading(false);
    }
  };

  // Load persisted settings once on mount; fall back to DEFAULTS for each key
  const [saved] = useState(() => storeSettings ?? loadSettings() ?? {});

  // ── Guardrails ──────────────────────────────────────────────────────────────
  const [minMargin, setMinMargin] = useState(
    () => saved.minMargin ?? DEFAULTS.minMargin
  );
  const [maxPriceChange, setMaxPriceChange] = useState(
    () => saved.maxPriceChange ?? DEFAULTS.maxPriceChange
  );
  const [competitorMatchBuffer, setCompetitorMatchBuffer] = useState(
    () => saved.competitorMatchBuffer ?? DEFAULTS.competitorMatchBuffer
  );
  const [requireHumanApproval, setRequireHumanApproval] = useState(
    () => saved.requireHumanApproval ?? DEFAULTS.requireHumanApproval
  );

  // ── Model parameters ────────────────────────────────────────────────────────
  const [modelConfidenceFloor, setModelConfidenceFloor] = useState(
    () => saved.modelConfidenceFloor ?? DEFAULTS.modelConfidenceFloor
  );
  const [shapDepth, setShapDepth] = useState(
    () => saved.shapDepth ?? DEFAULTS.shapDepth
  );
  const [retrainFrequency, setRetrainFrequency] = useState(
    () => saved.retrainFrequency ?? DEFAULTS.retrainFrequency
  );

  // ── Notifications ───────────────────────────────────────────────────────────
  const [emailAlerts, setEmailAlerts] = useState(
    () => saved.emailAlerts ?? DEFAULTS.emailAlerts
  );
  const [stockoutAlerts, setStockoutAlerts] = useState(
    () => saved.stockoutAlerts ?? DEFAULTS.stockoutAlerts
  );
  const [competitorPriceDrops, setCompetitorPriceDrops] = useState(
    () => saved.competitorPriceDrops ?? DEFAULTS.competitorPriceDrops
  );
  const [storeLocation, setStoreLocation] = useState(
    () => saved.storeLocation ?? DEFAULTS.storeLocation
  );

  /**
   * Validate, persist, and notify.
   * Each section saves ALL settings atomically so the stored object is always
   * a complete snapshot — no partial overwrite risk.
   */
  const handleSave = (section) => {
    // Input validation for numeric guardrail fields
    const bufferNum = parseFloat(competitorMatchBuffer);
    if (section === 'Guardrails') {
      if (isNaN(bufferNum)) {
        addToast(
          'Invalid Input',
          'Competitor Undercut Tolerance must be a valid number (e.g. 3.5).',
          'danger'
        );
        return;
      }
      if (bufferNum < 0 || bufferNum > 50) {
        addToast(
          'Out of Range',
          'Competitor Undercut Tolerance must be between 0 and 50.',
          'warning'
        );
        return;
      }
    }

    // Build the full settings snapshot from current React state
    const snapshot = {
      minMargin: Number(minMargin),
      maxPriceChange: Number(maxPriceChange),
      competitorMatchBuffer: bufferNum,
      requireHumanApproval,
      modelConfidenceFloor: Number(modelConfidenceFloor),
      shapDepth,
      retrainFrequency,
      emailAlerts,
      stockoutAlerts,
      competitorPriceDrops,
      storeLocation,
    };

    try {
      persistSettings(snapshot);
      if (updateSettings) {
        updateSettings(snapshot);
      }
      addToast(
        'Settings Saved',
        `Your ${section} configurations have been saved and applied to the pricing engine.`,
        'success'
      );
    } catch {
      addToast(
        'Save Failed',
        'Unable to save settings. Your browser storage may be full or restricted.',
        'danger'
      );
    }
  };


  return (
    <div>
      <div className="page-header-row">
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Settings size={22} color="var(--primary)" />
            <span>System Settings & Pricing Guardrails</span>
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Configure safety thresholds, machine learning model parameters, and store policies.
          </p>
        </div>
      </div>

      <div className="settings-grid">
        {/* Settings Navigation */}
        <div className="card-glass" style={{ padding: '1rem', height: 'fit-content' }}>
          <div className="settings-nav-list">
            <button
              className={`settings-nav-item ${activeTab === 'guardrails' ? 'active' : ''}`}
              onClick={() => setActiveTab('guardrails')}
            >
              <Shield size={16} />
              <span>Pricing Guardrails</span>
            </button>

            <button
              className={`settings-nav-item ${activeTab === 'model' ? 'active' : ''}`}
              onClick={() => setActiveTab('model')}
            >
              <Cpu size={16} />
              <span>AI Model & SHAP</span>
            </button>

            <button
              className={`settings-nav-item ${activeTab === 'store' ? 'active' : ''}`}
              onClick={() => setActiveTab('store')}
            >
              <Store size={16} />
              <span>Store & Currency</span>
            </button>

            <button
              className={`settings-nav-item ${activeTab === 'notifications' ? 'active' : ''}`}
              onClick={() => setActiveTab('notifications')}
            >
              <Bell size={16} />
              <span>Notifications & Alerts</span>
            </button>

            <button
              className={`settings-nav-item ${activeTab === 'appearance' ? 'active' : ''}`}
              onClick={() => setActiveTab('appearance')}
            >
              <Palette size={16} />
              <span>Appearance</span>
            </button>

            <button
              className={`settings-nav-item ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <KeyRound size={16} />
              <span>Security & Password</span>
            </button>
          </div>
        </div>

        {/* Settings Content Panels */}
        <div className="settings-section-card">
          {/* Tab 1: Pricing Guardrails */}
          {activeTab === 'guardrails' && (
            <div>
              <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Autonomous Pricing Guardrails</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Set boundary rules that the AI optimization model is strictly forbidden to violate.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span>Minimum Gross Margin Floor (%)</span>
                  <strong style={{ color: 'var(--text-accent)' }}>{minMargin}%</strong>
                </label>
                <input
                  type="range"
                  className="custom-range"
                  min="10"
                  max="50"
                  step="1"
                  value={minMargin}
                  onChange={(e) => setMinMargin(e.target.value)}
                />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Prices will never be lowered below cost + {minMargin}%, preventing unprofitable sales.
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label className="form-label">
                  <span>Maximum Price Change Velocity (&plusmn; % Per Cycle)</span>
                  <strong style={{ color: 'var(--text-accent)' }}>&plusmn;{maxPriceChange}%</strong>
                </label>
                <input
                  type="range"
                  className="custom-range"
                  min="5"
                  max="40"
                  step="1"
                  value={maxPriceChange}
                  onChange={(e) => setMaxPriceChange(e.target.value)}
                />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Limits single-day price jumps to prevent consumer sticker shock.
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label className="form-label">
                  <span>Competitor Undercut Tolerance (&plusmn; %)</span>
                  <strong style={{ color: 'var(--text-accent)' }}>{competitorMatchBuffer}%</strong>
                </label>
                <input
                  type="number"
                  className="form-input"
                  step="0.5"
                  value={competitorMatchBuffer}
                  onChange={(e) => setCompetitorMatchBuffer(e.target.value)}
                />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Maximum price gap allowed between store price and nearest benchmark rival.
                </div>
              </div>

              <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Require Human Approval for Price Updates</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>When enabled, suggestions must be manually accepted in the dashboard.</div>
                </div>
                <input
                  type="checkbox"
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  checked={requireHumanApproval}
                  onChange={(e) => setRequireHumanApproval(e.target.checked)}
                />
              </div>

              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={() => handleSave('Guardrails')}>
                  <Save size={15} />
                  <span>Save Guardrail Rules</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: AI Model & SHAP */}
          {activeTab === 'model' && (
            <div>
              <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>AI Model & SHAP Calibration</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Tune model hyperparameters, confidence thresholds, and explainability detail.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <span>Minimum Confidence Score for Automated Suggestions</span>
                  <strong style={{ color: 'var(--text-accent)' }}>{modelConfidenceFloor}%</strong>
                </label>
                <input
                  type="range"
                  className="custom-range"
                  min="70"
                  max="99"
                  value={modelConfidenceFloor}
                  onChange={(e) => setModelConfidenceFloor(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label className="form-label">SHAP Explanation Depth</label>
                <select
                  className="form-select"
                  value={shapDepth}
                  onChange={(e) => setShapDepth(e.target.value)}
                >
                  <option value="Full Additive (5 Factors)">Full Additive (Top 5 Factors)</option>
                  <option value="Executive Summary (Top 3)">Executive Summary (Top 3 Factors)</option>
                  <option value="Exhaustive (All 12 Features)">Exhaustive (All 12 Features)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label className="form-label">Model Re-Training Schedule</label>
                <select
                  className="form-select"
                  value={retrainFrequency}
                  onChange={(e) => setRetrainFrequency(e.target.value)}
                >
                  <option value="Daily at 02:00 AM">Daily at 02:00 AM (Recommended)</option>
                  <option value="Weekly Every Sunday">Weekly Every Sunday</option>
                  <option value="Real-time Streaming (Every 4 Hours)">Real-time Streaming (Every 4 Hours)</option>
                </select>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Saves retraining schedule preference. (Note: Automated background model updates execute via scheduled batch runner; streaming retraining requires Dataproc/Beam pipeline integration).
                </div>
              </div>

              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-ai" onClick={() => handleSave('Model Calibration')}>
                  <Cpu size={15} />
                  <span>Update Model Parameters</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab 3: Store & Currency */}
          {activeTab === 'store' && (
            <div>
              <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Store & Regional Preferences</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Multi-currency configuration and default store outlet assignment.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Currency Symbol</label>
                <select
                  className="form-select"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="₹">INR (₹) - Indian Rupee (Default)</option>
                  <option value="$">USD ($) - US Dollar</option>
                  <option value="€">EUR (€) - Euro</option>
                  <option value="£">GBP (£) - British Pound</option>
                </select>
              </div>

              <div className="form-group" style={{ marginTop: '1.25rem' }}>
                <label className="form-label">Primary Store Location</label>
                <input
                  type="text"
                  className="form-input"
                  value={storeLocation}
                  onChange={(e) => setStoreLocation(e.target.value)}
                />
              </div>

              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={() => handleSave('Store Preferences')}>
                  <Save size={15} />
                  <span>Save Regional Settings</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab 4: Notifications */}
          {activeTab === 'notifications' && (
            <div>
              <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Notification Channels</h3>
                  <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>In-App Active • External Gateway Optional</span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Configure real-time alerts. In-dashboard notification toasts and alert banners trigger immediately; email/SMS alerts require SMTP or webhook credentials configured in .env.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Critical Stockout Imminent Alerts</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Send urgent notification when stock falls below safety buffer.</div>
                  </div>
                  <input
                    type="checkbox"
                    style={{ width: '18px', height: '18px' }}
                    checked={stockoutAlerts}
                    onChange={(e) => setStockoutAlerts(e.target.checked)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Competitor Price Drop Trigger</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Notify when key rivals drop prices by more than 5%.</div>
                  </div>
                  <input
                    type="checkbox"
                    style={{ width: '18px', height: '18px' }}
                    checked={competitorPriceDrops}
                    onChange={(e) => setCompetitorPriceDrops(e.target.checked)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Daily Executive Summary Email</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Receive morning digest of revenue lift and optimization actions.</div>
                  </div>
                  <input
                    type="checkbox"
                    style={{ width: '18px', height: '18px' }}
                    checked={emailAlerts}
                    onChange={(e) => setEmailAlerts(e.target.checked)}
                  />
                </div>
              </div>

              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={() => handleSave('Notifications')}>
                  <Save size={15} />
                  <span>Save Notification Preferences</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab 5: Appearance / Theme */}
          {activeTab === 'appearance' && (
            <div>
              <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Appearance</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Choose a display theme. Your preference is saved and persists across sessions.
                </p>
              </div>

              {/* Theme selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Dark option */}
                <label
                  htmlFor="theme-dark"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1rem 1.25rem',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${theme === 'dark' ? 'var(--primary)' : 'var(--border-default)'}`,
                    background: theme === 'dark' ? 'var(--primary-light)' : 'var(--bg-surface)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    userSelect: 'none',
                  }}
                >
                  <input
                    id="theme-dark"
                    type="radio"
                    name="app-theme"
                    value="dark"
                    checked={theme === 'dark'}
                    onChange={() => setTheme('dark')}
                    style={{ accentColor: 'var(--primary)', width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0 }}
                  />
                  <Moon size={18} color={theme === 'dark' ? 'var(--primary)' : 'var(--text-muted)'} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Dark</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                      Deep navy analytics theme — easy on the eyes in low light.
                    </div>
                  </div>
                  {theme === 'dark' && (
                    <span style={{
                      marginLeft: 'auto',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.55rem',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--primary-light)',
                      color: 'var(--primary)',
                      border: '1px solid var(--border-glow)',
                    }}>Active</span>
                  )}
                </label>

                {/* Light option */}
                <label
                  htmlFor="theme-light"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1rem 1.25rem',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${theme === 'light' ? 'var(--primary)' : 'var(--border-default)'}`,
                    background: theme === 'light' ? 'var(--primary-light)' : 'var(--bg-surface)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    userSelect: 'none',
                  }}
                >
                  <input
                    id="theme-light"
                    type="radio"
                    name="app-theme"
                    value="light"
                    checked={theme === 'light'}
                    onChange={() => setTheme('light')}
                    style={{ accentColor: 'var(--primary)', width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0 }}
                  />
                  <Sun size={18} color={theme === 'light' ? 'var(--primary)' : 'var(--text-muted)'} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Light</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                      Clean white SaaS dashboard — ideal for bright environments.
                    </div>
                  </div>
                  {theme === 'light' && (
                    <span style={{
                      marginLeft: 'auto',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.55rem',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--primary-light)',
                      color: 'var(--primary)',
                      border: '1px solid var(--border-glow)',
                    }}>Active</span>
                  )}
                </label>
              </div>

              {/* Info note */}
              <div style={{
                marginTop: '1.5rem',
                padding: '0.85rem 1rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <Settings size={13} />
                <span>Theme preference is saved automatically and persists after browser refresh.</span>
              </div>
            </div>
          )}

          {/* Tab 6: Security & Password */}
          {activeTab === 'security' && (
            <div>
              <div className="settings-panel-header">
                <div>
                  <h3 className="settings-panel-title">Security & Authentication</h3>
                  <p className="settings-panel-desc">
                    Manage your credentials, password complexity, and session invalidation policies.
                  </p>
                </div>
              </div>

              {/* User Identity Banner */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                marginBottom: '1.5rem'
              }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{user?.name || 'Verified User'}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {user?.identifier || user?.email} • <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{user?.role}</span>
                  </div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <Badge variant="primary">Active Account</Badge>
                </div>
              </div>

              {secError && (
                <div className="alert-banner alert-danger" style={{ marginBottom: '1.25rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{secError}</span>
                </div>
              )}

              {secSuccess && (
                <div className="alert-banner alert-success" style={{ marginBottom: '1.25rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                  <span>{secSuccess}</span>
                </div>
              )}

              <form onSubmit={handleSecuritySave}>
                <div className="settings-field-row">
                  <div className="settings-field-info">
                    <label className="settings-field-label">Current Password</label>
                    <span className="settings-field-hint">Verify your identity before updating password</span>
                  </div>
                  <div className="settings-field-control" style={{ position: 'relative' }}>
                    <input
                      type={showSecCurrent ? 'text' : 'password'}
                      className="form-input"
                      style={{ paddingRight: '2.5rem' }}
                      value={secCurrentPassword}
                      onChange={(e) => { setSecCurrentPassword(e.target.value); setSecError(''); }}
                      placeholder="Enter current password"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecCurrent(!showSecCurrent)}
                      style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      {showSecCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="settings-field-row">
                  <div className="settings-field-info">
                    <label className="settings-field-label">New Password</label>
                    <span className="settings-field-hint">Minimum 8 characters with letters and numbers or symbols</span>
                  </div>
                  <div className="settings-field-control" style={{ position: 'relative' }}>
                    <input
                      type={showSecNew ? 'text' : 'password'}
                      className="form-input"
                      style={{ paddingRight: '2.5rem' }}
                      value={secNewPassword}
                      onChange={(e) => { setSecNewPassword(e.target.value); setSecError(''); }}
                      placeholder="Minimum 8 characters"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecNew(!showSecNew)}
                      style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      {showSecNew ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="settings-field-row">
                  <div className="settings-field-info">
                    <label className="settings-field-label">Confirm New Password</label>
                    <span className="settings-field-hint">Re-enter your new password</span>
                  </div>
                  <div className="settings-field-control">
                    <input
                      type={showSecNew ? 'text' : 'password'}
                      className="form-input"
                      value={secConfirmPassword}
                      onChange={(e) => { setSecConfirmPassword(e.target.value); setSecError(''); }}
                      placeholder="Re-enter new password"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                {/* Password Strength Checklist */}
                <div style={{
                  margin: '1.25rem 0',
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.78rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem'
                }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-accent)', marginBottom: '0.2rem' }}>
                    Password Requirements:
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: secNewPassword.length >= 8 ? 'var(--success)' : 'var(--text-muted)' }}>
                    <span>{secNewPassword.length >= 8 ? '✓' : '○'}</span>
                    <span>At least 8 characters long</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: (/[a-zA-Z]/.test(secNewPassword) && (/[0-9]|[^a-zA-Z0-9]/.test(secNewPassword))) ? 'var(--success)' : 'var(--text-muted)' }}>
                    <span>{(/[a-zA-Z]/.test(secNewPassword) && (/[0-9]|[^a-zA-Z0-9]/.test(secNewPassword))) ? '✓' : '○'}</span>
                    <span>Mix of letters and numbers or symbols</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: (secNewPassword.length > 0 && secNewPassword === secConfirmPassword) ? 'var(--success)' : 'var(--text-muted)' }}>
                    <span>{(secNewPassword.length > 0 && secNewPassword === secConfirmPassword) ? '✓' : '○'}</span>
                    <span>Passwords match</span>
                  </div>
                </div>

                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                  🔒 Security Policy: Changing your password will immediately revoke all previously issued session tokens.
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={secLoading || secNewPassword.length < 8 || secNewPassword !== secConfirmPassword}
                  >
                    <Save size={15} />
                    <span>{secLoading ? 'Updating...' : 'Update Password & Revoke Sessions'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
