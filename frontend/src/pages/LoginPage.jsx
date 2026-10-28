import React, { useState } from 'react';
import {
  Sparkles,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  TrendingUp,
  Zap,
  ShieldCheck,
  AlertCircle,
  Package,
  UserCheck,
  Brain,
  User,
  CheckCircle2,
  Check,
  LogIn,
  UserPlus,
  Activity,
  Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { soundEffects } from '../utils/soundEffects';
import { ForgotPasswordModal } from '../components/common/ForgotPasswordModal';
import { ToastContainer } from '../components/common/ToastContainer';

// Feature highlights for the left panel
const FEATURES = [
  {
    icon: TrendingUp,
    label: 'Demand Forecasting',
    desc: 'ML-driven elasticity models & trends',
    color: 'var(--primary)',
    bg: 'var(--primary-light)',
  },
  {
    icon: Zap,
    label: 'Price Optimization',
    desc: 'Real-time AI recommendations & guardrails',
    color: 'var(--info)',
    bg: 'var(--info-bg)',
  },
  {
    icon: Package,
    label: 'Inventory Intelligence',
    desc: 'Stockout risk & restock prediction',
    color: 'var(--success)',
    bg: 'var(--success-bg)',
  },
  {
    icon: Brain,
    label: 'SHAP Explainability',
    desc: 'Transparent glassbox feature attribution',
    color: 'var(--purple)',
    bg: 'var(--purple-bg)',
  },
];

const DEMO_PROFILES = {
  'Retail Pricing Manager': {
    title: 'Pricing Lead',
    email: 'pradeep.retail@smartprice.ai',
    role: 'Retail Pricing Manager',
    demoPassword: 'SmartPrice@2026!',
    badge: 'Pricing Approver'
  },
  'Senior Merchandising Analyst': {
    title: 'Analyst',
    email: 'analyst.sarah@smartprice.ai',
    role: 'Senior Merchandising Analyst',
    demoPassword: 'Sarah@SmartPrice2026!',
    badge: 'What-If Exploration'
  },
  'Store Operations Director': {
    title: 'Director',
    email: 'marcus.vance@smartprice.ai',
    role: 'Store Operations Director',
    demoPassword: 'Marcus@SmartPrice2026!',
    badge: 'Executive Overrides'
  }
};

export const LoginPage = ({ onLoginSuccess }) => {
  const { login, register, loading } = useAuth();
  const storeContext = useStore();
  const addToast = storeContext?.addToast;

  // Active Tab: 'login' | 'register'
  const [activeTab, setActiveTab] = useState('login');

  // --- Sign-in state ---
  const [selectedProfile, setSelectedProfile] = useState('Retail Pricing Manager');
  const [loginEmail, setLoginEmail] = useState('pradeep.retail@smartprice.ai');
  const [loginPassword, setLoginPassword] = useState('SmartPrice@2026!');
  const [role, setRole] = useState('Retail Pricing Manager');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginInfoMessage, setLoginInfoMessage] = useState('Pricing Lead credentials loaded. Ready to sign in.');
  const [isForgotOpen, setIsForgotOpen] = useState(false);

  // --- Registration state ---
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [regError, setRegError] = useState('');
  const [regSuccessMessage, setRegSuccessMessage] = useState('');

  // Password Strength Evaluation for Registration
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: 'None', class: '' };
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (pwd.length >= 12) score += 1;
    if (/[a-zA-Z]/.test(pwd)) score += 1;
    if (/[0-9]|[^a-zA-Z0-9]/.test(pwd)) score += 1;

    if (score <= 1) return { score: 1, label: 'Weak', class: 'weak' };
    if (score === 2) return { score: 2, label: 'Fair', class: 'fair' };
    if (score === 3) return { score: 3, label: 'Good', class: 'good' };
    return { score: 4, label: 'Strong', class: 'strong' };
  };

  const strength = getPasswordStrength(regPassword);
  const hasMinLength = regPassword.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(regPassword);
  const hasDigitOrSpecial = /[0-9]|[^a-zA-Z0-9]/.test(regPassword);
  const passwordsMatch = regConfirmPassword.length > 0 && regPassword === regConfirmPassword;

  // Handle Login Submission (Direct Password-Based Authentication)
  const handleLoginSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoginError('');

    const trimmedEmail = loginEmail.trim();
    if (!trimmedEmail) {
      setLoginError('Please enter your email or username.');
      soundEffects?.playAlert?.();
      return;
    }

    if (!loginPassword) {
      setLoginError('Please enter your password.');
      soundEffects?.playAlert?.();
      return;
    }

    try {
      const res = await login({
        identifier: trimmedEmail,
        password: loginPassword,
        role: role,
      });

      soundEffects?.playSuccess?.();
      if (addToast) {
        addToast(
          'Authentication Successful',
          `Welcome back, ${res.user?.name || trimmedEmail}!`,
          'success'
        );
      }
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      soundEffects?.playAlert?.();
      const message = err.message || 'Login failed. Please verify credentials.';
      setLoginError(message);
      if (addToast) {
        addToast('Sign-In Failed', message, 'error');
      }
    }
  };

  // Direct Account Registration Submission
  const handleRegisterSubmit = async (e) => {
    if (e) e.preventDefault();
    setRegError('');
    setRegSuccessMessage('');

    const cleanName = regName.trim();
    const cleanEmail = regEmail.trim();

    if (!cleanName || cleanName.length < 2) {
      setRegError('Please enter your full name (at least 2 characters).');
      soundEffects?.playAlert?.();
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setRegError('Please enter a valid work email address.');
      soundEffects?.playAlert?.();
      return;
    }

    if (!regPassword) {
      setRegError('Password is required.');
      soundEffects?.playAlert?.();
      return;
    }

    if (regPassword.length < 8) {
      setRegError('Password must be at least 8 characters long.');
      soundEffects?.playAlert?.();
      return;
    }

    if (!hasLetter || !hasDigitOrSpecial) {
      setRegError('Password must contain at least one letter and at least one number or special character.');
      soundEffects?.playAlert?.();
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setRegError('Passwords do not match.');
      soundEffects?.playAlert?.();
      return;
    }

    try {
      const response = await register({
        name: cleanName,
        email: cleanEmail,
        password: regPassword,
        confirmPassword: regConfirmPassword,
      });

      soundEffects?.playSuccess?.();
      const successMsg = response.message || 'Account created successfully! Welcome to SmartPrice.';
      setRegSuccessMessage(successMsg);

      if (addToast) {
        addToast('Account Created', `Welcome to SmartPrice, ${cleanName}!`, 'success');
      }

      // If backend returned a valid session token, log in directly
      if (response.session && response.session.token) {
        setTimeout(() => {
          if (onLoginSuccess) onLoginSuccess();
        }, 600);
      } else {
        // Prepopulate login tab
        setLoginEmail(cleanEmail);
        setLoginPassword(regPassword);
        setLoginInfoMessage('Account created! Please sign in with your credentials.');
        setTimeout(() => {
          setActiveTab('login');
        }, 1200);
      }
    } catch (err) {
      soundEffects?.playAlert?.();
      const message = err.message || 'Registration failed. Please check your inputs.';
      setRegError(message);
      if (addToast) {
        addToast('Registration Error', message, 'error');
      }
    }
  };

  // Quick role profile switcher (pre-populates credentials without bypassing authentication)
  const handleQuickProfile = (targetRole) => {
    setLoginError('');
    const profile = DEMO_PROFILES[targetRole] || DEMO_PROFILES['Retail Pricing Manager'];
    setLoginEmail(profile.email);
    setRole(targetRole);
    setSelectedProfile(targetRole);
    setLoginPassword(profile.demoPassword);
    setLoginInfoMessage(`Loaded ${profile.title} profile (${profile.email}). Click Sign In to access dashboard.`);
    soundEffects?.playSelect?.();
  };

  return (
    <div className="login-page-container">
      {/* Toast Notification Container for interactive user feedback */}
      <ToastContainer />

      {/* ── LEFT: Background image + overlay + branding + analytics visual ── */}
      <div className="login-left-hero">
        <div className="login-left-inner">

          {/* Brand lockup */}
          <div className="login-brand-row">
            <div className="login-brand-logo">
              <Sparkles size={26} color="#FFFFFF" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span className="brand-title" style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
                  Smart<span style={{ color: '#6366F1' }}>Price</span>
                </span>
                <span className="login-brand-badge">
                  <Activity size={12} />
                  Enterprise AI
                </span>
              </div>
              <span style={{ fontSize: '0.74rem', color: '#94A3B8', fontWeight: 600, letterSpacing: '0.04em' }}>
                Explainable AI Retail Intelligence
              </span>
            </div>
          </div>

          {/* Headline and Tagline */}
          <div className="login-hero-headline">
            <h1>
              Smarter Pricing.<br />
              <span className="text-gradient">Better Decisions.</span>
            </h1>
            <p className="login-hero-subtext">
              AI-powered elasticity forecasting, dynamic pricing guardrails, and glassbox explainability to maximize retail margin and inventory velocity.
            </p>
          </div>

          {/* Retail Analytics Preview Widget */}
          <div className="login-analytics-widget">
            <div className="analytics-widget-top">
              <div className="analytics-widget-title">
                <span className="analytics-pulse-dot" />
                <span>Live Optimization Engine</span>
              </div>
              <span className="analytics-live-tag">98.4% Confidence</span>
            </div>

            {/* Simulated Elasticity SVG Chart */}
            <div style={{ position: 'relative', width: '100%', height: '70px', overflow: 'hidden' }}>
              <svg width="100%" height="70" viewBox="0 0 380 70" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366F1" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#6366F1" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#06B6D4" />
                    <stop offset="50%" stopColor="#6366F1" />
                    <stop offset="100%" stopColor="#A855F7" />
                  </linearGradient>
                </defs>
                {/* Area under curve */}
                <path
                  d="M 0,60 Q 90,55 180,25 T 380,48 L 380,70 L 0,70 Z"
                  fill="url(#curveGradient)"
                />
                {/* Smooth Curve */}
                <path
                  d="M 0,60 Q 90,55 180,25 T 380,48"
                  fill="none"
                  stroke="url(#lineGradient)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                {/* Optimal Price Point marker */}
                <circle cx="180" cy="25" r="4.5" fill="#38BDF8" stroke="#FFFFFF" strokeWidth="1.5" />
                <circle cx="180" cy="25" r="9" fill="#38BDF8" opacity="0.3" />
              </svg>
            </div>

            {/* Metrics Row */}
            <div className="analytics-metrics-strip">
              <div className="analytics-metric-cell">
                <div className="analytics-metric-val" style={{ color: 'var(--success)' }}>
                  <TrendingUp size={14} />
                  +14.8%
                </div>
                <div className="analytics-metric-lbl">Projected Margin Lift</div>
              </div>
              <div className="analytics-metric-cell">
                <div className="analytics-metric-val" style={{ color: 'var(--text-accent)' }}>
                  <ShieldCheck size={14} />
                  0 Breaches
                </div>
                <div className="analytics-metric-lbl">Cost Guardrails Safe</div>
              </div>
              <div className="analytics-metric-cell">
                <div className="analytics-metric-val" style={{ color: 'var(--purple)' }}>
                  <Package size={14} />
                  1,420
                </div>
                <div className="analytics-metric-lbl">Auto-Optimized SKUs</div>
              </div>
            </div>

            {/* Real-time SHAP Attribution Drivers */}
            <div className="analytics-shap-strip">
              <span className="analytics-shap-title">
                <Brain size={12} />
                SHAP Drivers:
              </span>
              <span className="analytics-shap-pill">Competitor Index (-38%)</span>
              <span className="analytics-shap-pill">Stock Velocity (+29%)</span>
              <span className="analytics-shap-pill">Seasonality (+33%)</span>
            </div>
          </div>

          {/* 4 Feature highlights */}
          <div className="login-features-grid">
            {FEATURES.map(({ icon: Icon, label, desc, color, bg }) => (
              <div key={label} className="login-feature-item">
                <div className="login-feature-icon" style={{ background: bg, color }}>
                  <Icon size={16} />
                </div>
                <div>
                  <div className="login-feature-label">{label}</div>
                  <div className="login-feature-desc">{desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Trust / security footer */}
          <div className="login-trust-row">
            <ShieldCheck size={15} color="var(--success)" style={{ flexShrink: 0 }} />
            <span>Enterprise Grade Retail Intelligence &bull; SOC2 Type II &bull; Role-Governed Access</span>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Authentication card ─────────────────────────────────── */}
      <div className="login-right-form">
        <div className="login-card-wrapper">
          <div className="login-card animate-fade-in">

            {/* Navigation Tabs (Login vs Register) */}
            <div className="login-tabs-nav" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'login'}
                className={`login-tab-btn ${activeTab === 'login' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('login');
                  setRegError('');
                  soundEffects?.playClick?.();
                }}
              >
                <LogIn size={15} />
                <span>Sign In</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'register'}
                className={`login-tab-btn ${activeTab === 'register' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('register');
                  setLoginError('');
                  soundEffects?.playClick?.();
                }}
              >
                <UserPlus size={15} />
                <span>Create Account</span>
              </button>
            </div>

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* TAB 1: SIGN IN FORM (Direct Password-Based Authentication)     */}
            {/* ════════════════════════════════════════════════════════════════ */}
            {activeTab === 'login' && (
              <div className="login-tab-pane animate-fade-in">
                {/* Header */}
                <div className="login-card-header">
                  <div className="login-secure-badge">
                    <ShieldCheck size={13} />
                    <span>Secure Retail Portal</span>
                  </div>
                  <h2 className="login-card-title">Welcome Back</h2>
                  <p className="login-card-subtitle">
                    Enter your credentials to access your retail pricing workspace.
                  </p>
                </div>

                {/* Error banner */}
                {loginError && (
                  <div className="login-error-banner" role="alert">
                    <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{loginError}</span>
                  </div>
                )}

                {/* Sign-In Form */}
                <form onSubmit={handleLoginSubmit} noValidate>
                  {/* Email / Username */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="login-email">
                      <span>Email or Username</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>Required</span>
                    </label>
                    <div className="login-input-wrapper">
                      <span className="login-input-icon"><Mail size={15} /></span>
                      <input
                        id="login-email"
                        type="text"
                        className="form-input login-input"
                        value={loginEmail}
                        onChange={(e) => { setLoginEmail(e.target.value); setLoginError(''); }}
                        placeholder="user@smartprice.ai"
                        autoComplete="username"
                        required
                      />
                    </div>
                  </div>

                  {/* Role selector */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="login-role">Select User Role</label>
                    <select
                      id="login-role"
                      className="form-select"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                    >
                      <option value="Retail Pricing Manager">Retail Pricing Manager (Standard Access)</option>
                      <option value="Senior Merchandising Analyst">Senior Merchandising Analyst (What-If)</option>
                      <option value="Store Operations Director">Store Operations Director (Executive Overrides)</option>
                      <option value="XAI Data Scientist">XAI Data Scientist (Explainability)</option>
                    </select>
                  </div>

                  {/* Password */}
                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <label className="form-label" htmlFor="login-password" style={{ marginBottom: 0 }}>
                        <span>Password</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500, marginLeft: '0.35rem' }}>Required</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsForgotOpen(true)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="login-input-wrapper">
                      <span className="login-input-icon"><Lock size={15} /></span>
                      <input
                        id="login-password"
                        type={showLoginPassword ? 'text' : 'password'}
                        className="form-input login-input"
                        value={loginPassword}
                        onChange={(e) => { setLoginPassword(e.target.value); setLoginError(''); }}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        required
                      />
                      <button
                        type="button"
                        className="login-pw-toggle"
                        onClick={() => setShowLoginPassword((v) => !v)}
                        aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                        tabIndex={0}
                      >
                        {showLoginPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Verified Profile Info Notice */}
                  {loginInfoMessage && !loginError && (
                    <div style={{
                      fontSize: '0.73rem',
                      color: 'var(--text-accent)',
                      background: 'rgba(6, 182, 212, 0.1)',
                      border: '1px solid rgba(6, 182, 212, 0.25)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.45rem 0.65rem',
                      marginBottom: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}>
                      <Sparkles size={13} color="var(--primary)" />
                      <span>{loginInfoMessage}</span>
                    </div>
                  )}

                  {/* Primary Submit CTA */}
                  <button
                    id="login-submit-btn"
                    type="submit"
                    className="btn btn-primary login-submit-btn"
                    disabled={loading}
                  >
                    {loading ? (
                      <span>Signing In...</span>
                    ) : (
                      <>
                        <span>Sign In</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="login-divider">
                  <span>or use a quick verified profile</span>
                </div>

                {/* Quick Verified Profiles */}
                <div className="demo-credentials-box">
                  <div className="login-profiles-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: 'var(--text-accent)' }}>
                      <UserCheck size={14} color="var(--primary)" />
                      <span>Quick Verified Profiles</span>
                    </div>
                    <span className="login-instant-badge">&bull; Real Backend Credentials</span>
                  </div>
                  <p style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', marginBottom: '0.65rem' }}>
                    Select a verified profile to load credentials and test role permissions:
                  </p>
                  <div className="demo-btn-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.45rem' }}>
                    {Object.entries(DEMO_PROFILES).map(([key, prof]) => {
                      const isSelected = selectedProfile === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => handleQuickProfile(key)}
                          title={`${prof.title} (${prof.email})`}
                          style={{ fontWeight: 600, fontSize: '0.78rem' }}
                        >
                          {prof.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* TAB 2: REGISTER FORM (Direct Account Provisioning)             */}
            {/* ════════════════════════════════════════════════════════════════ */}
            {activeTab === 'register' && (
              <div className="register-tab-pane animate-fade-in">
                {/* Header */}
                <div className="login-card-header">
                  <div className="login-secure-badge" style={{ background: 'rgba(16, 185, 129, 0.12)', color: 'var(--success)' }}>
                    <UserPlus size={13} />
                    <span>Real Account Provisioning</span>
                  </div>
                  <h2 className="login-card-title">Create Account</h2>
                  <p className="login-card-subtitle">
                    Register an enterprise account to access retail elasticity intelligence.
                  </p>
                </div>

                {/* Error Banner */}
                {regError && (
                  <div className="login-error-banner" role="alert">
                    <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ flex: 1 }}>
                      <span>{regError}</span>
                      {regError.toLowerCase().includes('already exists') && (
                        <div style={{ marginTop: '0.35rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setLoginEmail(regEmail);
                              setActiveTab('login');
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-primary)',
                              textDecoration: 'underline',
                              cursor: 'pointer',
                              padding: 0,
                              fontSize: '0.78rem',
                              fontWeight: 700
                            }}
                          >
                            Switch to Sign In &rarr;
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Success Banner */}
                {regSuccessMessage && (
                  <div className="login-success-banner">
                    <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{regSuccessMessage}</span>
                  </div>
                )}

                {/* Enter Registration Details */}
                <form onSubmit={handleRegisterSubmit} noValidate>
                  {/* Full Name */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="reg-name">
                      <span>Full Name</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Required</span>
                    </label>
                    <div className="login-input-wrapper">
                      <span className="login-input-icon"><User size={15} /></span>
                      <input
                        id="reg-name"
                        type="text"
                        className="form-input login-input"
                        value={regName}
                        onChange={(e) => { setRegName(e.target.value); setRegError(''); }}
                        placeholder="Pradeep Kumar"
                        autoComplete="name"
                        required
                      />
                    </div>
                  </div>

                  {/* Business Email */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="reg-email">
                      <span>Business Email</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Required</span>
                    </label>
                    <div className="login-input-wrapper">
                      <span className="login-input-icon"><Mail size={15} /></span>
                      <input
                        id="reg-email"
                        type="email"
                        className="form-input login-input"
                        value={regEmail}
                        onChange={(e) => { setRegEmail(e.target.value); setRegError(''); }}
                        placeholder="you@company.com"
                        autoComplete="email"
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="reg-password">
                      <span>Password</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Min. 8 characters</span>
                    </label>
                    <div className="login-input-wrapper">
                      <span className="login-input-icon"><Lock size={15} /></span>
                      <input
                        id="reg-password"
                        type={showRegPassword ? 'text' : 'password'}
                        className="form-input login-input"
                        value={regPassword}
                        onChange={(e) => { setRegPassword(e.target.value); setRegError(''); }}
                        placeholder="Create strong password"
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        className="login-pw-toggle"
                        onClick={() => setShowRegPassword((v) => !v)}
                        aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                        tabIndex={0}
                      >
                        {showRegPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>

                    {/* Password Strength Indicator */}
                    {regPassword && (
                      <div className="password-strength-container">
                        <div className="password-strength-bars">
                          <div className={`password-strength-bar ${strength.score >= 1 ? strength.class : ''}`} />
                          <div className={`password-strength-bar ${strength.score >= 2 ? strength.class : ''}`} />
                          <div className={`password-strength-bar ${strength.score >= 3 ? strength.class : ''}`} />
                          <div className={`password-strength-bar ${strength.score >= 4 ? strength.class : ''}`} />
                        </div>
                        <div className="password-strength-label">
                          <span>Password Strength</span>
                          <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>{strength.label}</span>
                        </div>
                        <div className="password-reqs">
                          <div className={`password-req-item ${hasMinLength ? 'met' : ''}`}>
                            {hasMinLength ? <Check size={11} /> : <span style={{ width: 11 }}>&bull;</span>}
                            <span>8+ characters</span>
                          </div>
                          <div className={`password-req-item ${hasLetter ? 'met' : ''}`}>
                            {hasLetter ? <Check size={11} /> : <span style={{ width: 11 }}>&bull;</span>}
                            <span>Contains letters</span>
                          </div>
                          <div className={`password-req-item ${hasDigitOrSpecial ? 'met' : ''}`}>
                            {hasDigitOrSpecial ? <Check size={11} /> : <span style={{ width: 11 }}>&bull;</span>}
                            <span>Number or symbol</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="reg-confirm-password">
                      <span>Confirm Password</span>
                      {passwordsMatch && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--success)', fontWeight: 600 }}>Passwords match</span>
                      )}
                    </label>
                    <div className={`login-input-wrapper ${regConfirmPassword && !passwordsMatch ? 'error' : ''}`}>
                      <span className="login-input-icon"><ShieldCheck size={15} /></span>
                      <input
                        id="reg-confirm-password"
                        type={showRegConfirmPassword ? 'text' : 'password'}
                        className="form-input login-input"
                        value={regConfirmPassword}
                        onChange={(e) => { setRegConfirmPassword(e.target.value); setRegError(''); }}
                        placeholder="Confirm your password"
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        className="login-pw-toggle"
                        onClick={() => setShowRegConfirmPassword((v) => !v)}
                        aria-label={showRegConfirmPassword ? 'Hide password' : 'Show password'}
                        tabIndex={0}
                      >
                        {showRegConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Security Role Notice */}
                  <div className="login-role-notice">
                    <Layers size={14} color="var(--primary)" style={{ flexShrink: 0 }} />
                    <span>
                      New accounts are provisioned with standard <strong>Retail Pricing Manager</strong> role access with margin guardrails.
                    </span>
                  </div>

                  {/* Submit CTA */}
                  <button
                    id="register-submit-btn"
                    type="submit"
                    className="btn btn-primary login-submit-btn"
                    disabled={loading || !hasMinLength || !passwordsMatch}
                  >
                    {loading ? (
                      <span>Creating Account...</span>
                    ) : (
                      <>
                        <span>Create Account</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>

                {/* Footer Switch */}
                <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('login');
                      soundEffects?.playClick?.();
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    Sign in here
                  </button>
                </div>
              </div>
            )}

          </div>{/* /login-card */}
        </div>{/* /login-card-wrapper */}
      </div>{/* /login-right-form */}

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotOpen}
        onClose={() => setIsForgotOpen(false)}
        initialIdentifier={loginEmail}
        onPasswordResetSuccess={(newPwd, updatedEmail) => {
          setLoginPassword(newPwd);
          if (updatedEmail) setLoginEmail(updatedEmail);
          setLoginInfoMessage('Password successfully updated. Ready to sign in!');
          setIsForgotOpen(false);
        }}
      />
    </div>
  );
};
