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
  BarChart3,
  Package,
  UserCheck,
  Brain,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { soundEffects } from '../utils/soundEffects';

// Feature highlights for left panel
const FEATURES = [
  {
    icon: TrendingUp,
    label: 'Demand Forecasting',
    desc: 'ML-driven elasticity models',
    color: 'var(--primary)',
    bg: 'var(--primary-light)',
  },
  {
    icon: Zap,
    label: 'Price Optimization',
    desc: 'Real-time AI recommendations',
    color: 'var(--info)',
    bg: 'var(--info-bg)',
  },
  {
    icon: Package,
    label: 'Inventory Intelligence',
    desc: 'Stockout & restock prediction',
    color: 'var(--success)',
    bg: 'var(--success-bg)',
  },
  {
    icon: Brain,
    label: 'SHAP Explainability',
    desc: 'Transparent feature attribution',
    color: 'var(--purple)',
    bg: 'var(--purple-bg)',
  },
];

export const LoginPage = ({ onLoginSuccess }) => {
  const { login, loginWithProfile, loading } = useAuth();

  // Form State — unchanged from original
  const [email, setEmail] = useState('pradeep.retail@smartprice.ai');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Retail Pricing Manager');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Handle direct sign-in form submit — logic unchanged
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email or username.');
      soundEffects.playAlert();
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      soundEffects.playAlert();
      return;
    }

    try {
      await login({
        identifier: trimmedEmail,
        password: password,
        role: role,
      });
      soundEffects.playSuccess();
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      soundEffects.playAlert();
      setError(err.message || 'Login failed. Please try again.');
    }
  };

  // Handle quick role profile selection — pre-fills profile identity safely
  const handleQuickProfile = (targetRole) => {
    setError('');
    let targetEmail = 'pradeep.retail@smartprice.ai';
    if (targetRole === 'Senior Merchandising Analyst') {
      targetEmail = 'analyst.sarah@smartprice.ai';
    } else if (targetRole === 'Store Operations Director') {
      targetEmail = 'marcus.vance@smartprice.ai';
    }
    setEmail(targetEmail);
    setRole(targetRole);
    setPassword('');
    soundEffects.playSelect?.();
    const pwdInput = document.getElementById('login-password');
    if (pwdInput) {
      pwdInput.focus();
    }
  };

  return (
    <div className="login-page-container">

      {/* ── LEFT: Background image + overlay + branding ───────────────── */}
      <div className="login-left-hero">

        {/* Gradient overlay rendered via CSS — see pages.css */}
        <div className="login-left-inner">

          {/* Brand lockup */}
          <div className="login-brand-row">
            <div className="brand-logo-icon" style={{ width: '46px', height: '46px', flexShrink: 0 }}>
              <Sparkles size={24} color="var(--primary)" />
            </div>
            <div>
              <span className="brand-title" style={{ fontSize: '1.45rem', display: 'block' }}>
                Smart<span>Price</span>
              </span>
              <span className="brand-tagline" style={{ fontSize: '0.72rem', letterSpacing: '0.08em' }}>
                AI DYNAMIC OPTIMIZATION
              </span>
            </div>
          </div>

          {/* Headline */}
          <div className="login-hero-headline">
            <h1>
              Smarter Pricing.<br />
              <span className="text-gradient">Better Decisions.</span>
            </h1>
            <p className="login-hero-subtext">
              AI-powered insights to optimize prices, forecast demand,
              and maximize retail revenue.
            </p>
          </div>

          {/* Feature highlights */}
          <div className="login-features-grid">
            {FEATURES.map(({ icon: Icon, label, desc, color, bg }) => (
              <div key={label} className="login-feature-item">
                <div className="login-feature-icon" style={{ background: bg, color }}>
                  <Icon size={17} />
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
            <span>Enterprise Grade Retail Intelligence &amp; Secure Role-Based Access</span>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Login card ─────────────────────────────────────────── */}
      <div className="login-right-form">
        <div className="login-card-wrapper">
          <div className="login-card animate-fade-in">

            {/* Card header */}
            <div className="login-card-header">
              <div className="login-secure-badge">
                <ShieldCheck size={13} />
                <span>Secure Retail Portal</span>
              </div>
              <h2 className="login-card-title">Welcome Back</h2>
              <p className="login-card-subtitle">Sign in to your SmartPrice account</p>
            </div>

            {/* Error banner */}
            {error && (
              <div className="login-error-banner">
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Form — all inputs/handlers identical to original */}
            <form onSubmit={handleSubmit} noValidate>
              {/* Email */}
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
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
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
                  <option value="Retail Pricing Manager">Retail Pricing Manager (Full Access)</option>
                  <option value="Senior Merchandising Analyst">Senior Merchandising Analyst</option>
                  <option value="Store Operations Director">Store Operations Director</option>
                  <option value="XAI Data Scientist">XAI Data Scientist</option>
                </select>
              </div>

              {/* Password */}
              <div className="form-group">
                <label className="form-label" htmlFor="login-password">
                  <span>Password</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>Required</span>
                </label>
                <div className="login-input-wrapper">
                  <span className="login-input-icon"><Lock size={15} /></span>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input login-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="login-pw-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={0}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Primary CTA */}
              <button
                id="login-submit-btn"
                type="submit"
                className="btn btn-primary login-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <span>Enter SmartPrice Dashboard</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="login-divider">
              <span>or use a quick profile</span>
            </div>

            {/* Quick verified profiles — unchanged from original */}
            <div className="demo-credentials-box">
              <div className="login-profiles-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: 'var(--text-accent)' }}>
                  <UserCheck size={14} color="var(--primary)" />
                  <span>Quick Verified Profiles</span>
                </div>
                <span className="login-instant-badge">● Role Switcher</span>
              </div>
              <p style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', marginBottom: '0.65rem' }}>
                Select a verified profile to pre-fill your account credentials:
              </p>
              <div className="demo-btn-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.45rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleQuickProfile('Retail Pricing Manager')}
                  title="Retail Pricing Lead"
                  style={{ fontWeight: 600 }}
                >
                  Pricing Lead
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleQuickProfile('Senior Merchandising Analyst')}
                  title="Merchandising Analyst"
                  style={{ fontWeight: 600 }}
                >
                  Analyst
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleQuickProfile('Store Operations Director')}
                  title="Store Director"
                  style={{ fontWeight: 600 }}
                >
                  Director
                </button>
              </div>
            </div>

          </div>{/* /login-card */}
        </div>{/* /login-card-wrapper */}
      </div>{/* /login-right-form */}

    </div>
  );
};
