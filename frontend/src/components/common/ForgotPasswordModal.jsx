import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, KeyRound, AlertCircle, CheckCircle2, X, ArrowRight, Terminal } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { soundEffects } from '../../utils/soundEffects';

export const ForgotPasswordModal = ({ isOpen, onClose, initialIdentifier = '', onPasswordResetSuccess }) => {
  const [step, setStep] = useState(1); // 1: request token, 2: reset password, 3: completed
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [devToken, setDevToken] = useState(null);

  if (!isOpen) return null;

  const hasMinLength = newPassword.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const hasDigitOrSpecial = /[0-9]|[^a-zA-Z0-9]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  // Step 1: Request recovery token
  const handleRequestReset = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setDevToken(null);

    const cleanId = identifier.trim();
    if (!cleanId) {
      setError('Please enter your email or username.');
      soundEffects?.playAlert?.();
      return;
    }

    setLoading(true);
    try {
      const res = await apiService.forgotPassword(cleanId);
      setSuccessMessage(res.message || 'If an account exists with this identifier, a recovery token has been generated.');
      soundEffects?.playSuccess?.();

      if (res.dev_reset_token) {
        setDevToken(res.dev_reset_token);
      } else {
        setStep(2);
      }
    } catch (err) {
      setError(err?.message || 'Failed to request password reset.');
      soundEffects?.playAlert?.();
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Submit new password with recovery token
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    const cleanToken = resetToken.trim();
    if (!cleanToken) {
      setError('Password reset recovery token is required.');
      soundEffects?.playAlert?.();
      return;
    }

    if (!hasMinLength) {
      setError('New password must be at least 8 characters long.');
      soundEffects?.playAlert?.();
      return;
    }

    if (!hasLetter || !hasDigitOrSpecial) {
      setError('New password must contain at least one letter and at least one number or symbol.');
      soundEffects?.playAlert?.();
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match.');
      soundEffects?.playAlert?.();
      return;
    }

    setLoading(true);
    try {
      const res = await apiService.resetPassword({
        token: cleanToken,
        newPassword,
        confirmPassword,
      });
      soundEffects?.playSuccess?.();
      setSuccessMessage(res.message || 'Password successfully reset!');
      setStep(3); // Completed step
      if (onPasswordResetSuccess) {
        onPasswordResetSuccess(newPassword, identifier.trim());
      }
    } catch (err) {
      setError(err?.message || 'Password reset failed.');
      soundEffects?.playAlert?.();
    } finally {
      setLoading(false);
    }
  };

  const handleUseDevToken = () => {
    if (devToken) {
      setResetToken(devToken);
      setStep(2);
      setError('');
    }
  };

  const handleClose = () => {
    setError('');
    setSuccessMessage('');
    setDevToken(null);
    setResetToken('');
    setNewPassword('');
    setConfirmPassword('');
    setStep(1);
    onClose();
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }}>
      <div className="modal-content" style={{ maxWidth: '440px', width: '92%' }}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)'
            }}>
              <KeyRound size={16} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                {step === 1 ? 'Forgot Password' : step === 2 ? 'Set New Password' : 'Password Reset Complete'}
              </h3>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                {step === 1 ? 'Request verified recovery token' : step === 2 ? 'Enter recovery token & new password' : 'Your credentials have been updated'}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleClose}
            style={{ padding: '0.25rem', borderRadius: '50%' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ padding: '1.25rem' }}>
          {error && (
            <div className="alert-banner alert-danger" style={{ marginBottom: '1rem', fontSize: '0.78rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleRequestReset}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Enter your SmartPrice account email or username. If an account is found, a secure, single-use 15-minute recovery token will be issued.
              </p>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>Email or Username</label>
                <div className="login-input-wrapper" style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                    <Mail size={15} />
                  </span>
                  <input
                    type="text"
                    className="form-input"
                    style={{ paddingLeft: '2.2rem', width: '100%' }}
                    value={identifier}
                    onChange={(e) => { setIdentifier(e.target.value); setError(''); }}
                    placeholder="e.g. pradeep.retail@smartprice.ai"
                    required
                  />
                </div>
              </div>

              {/* Success notice */}
              {successMessage && (
                <div className="alert-banner alert-success" style={{ marginBottom: '1rem', fontSize: '0.78rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Development Mode Token Helper */}
              {devToken && (
                <div style={{
                  marginBottom: '1rem',
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(14, 165, 233, 0.12)',
                  border: '1px solid rgba(14, 165, 233, 0.35)',
                  fontSize: '0.76rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.4rem' }}>
                    <Terminal size={14} />
                    <span>Recovery Token Issued</span>
                  </div>
                  <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                    Your single-use recovery token is available below. Use it to securely set your new password:
                  </p>
                  <code style={{
                    display: 'block',
                    padding: '0.35rem 0.5rem',
                    background: 'var(--bg-card-subtle, rgba(0,0,0,0.3))',
                    borderRadius: 'var(--radius-xs)',
                    fontSize: '0.7rem',
                    wordBreak: 'break-all',
                    marginBottom: '0.6rem',
                    color: 'var(--text-accent)'
                  }}>
                    {devToken}
                  </code>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ width: '100%', fontSize: '0.75rem', fontWeight: 600 }}
                    onClick={handleUseDevToken}
                  >
                    Use Token to Set New Password <ArrowRight size={13} />
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setStep(2)}
                  style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
                >
                  I already have a token
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={loading}
                >
                  {loading ? 'Requesting...' : 'Request Recovery Token'}
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleResetPassword}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>Password Reset Recovery Token</label>
                <div className="login-input-wrapper" style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                    <KeyRound size={15} />
                  </span>
                  <input
                    id="reset-token-input"
                    type="text"
                    className="form-input"
                    style={{ paddingLeft: '2.2rem', width: '100%', fontFamily: 'monospace', fontSize: '0.8rem' }}
                    value={resetToken}
                    onChange={(e) => {
                      setResetToken(e.target.value);
                      setError('');
                    }}
                    placeholder="Enter or paste recovery token"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>New Password</label>
                <div className="login-input-wrapper" style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                    <Lock size={15} />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    style={{ width: '100%', paddingLeft: '2.2rem', paddingRight: '2.5rem' }}
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.65rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)'
                    }}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>Confirm New Password</label>
                <div className="login-input-wrapper" style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                    <Lock size={15} />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    style={{ width: '100%', paddingLeft: '2.2rem' }}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>

              {/* Password Requirements Checklist */}
              <div style={{
                background: 'var(--bg-card-subtle, rgba(255,255,255,0.03))',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.55rem 0.75rem',
                fontSize: '0.72rem',
                color: 'var(--text-secondary)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem',
                marginBottom: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: hasMinLength ? 'var(--success)' : 'inherit' }}>
                  <span>{hasMinLength ? '✓' : '○'}</span>
                  <span>At least 8 characters long</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: (hasLetter && hasDigitOrSpecial) ? 'var(--success)' : 'inherit' }}>
                  <span>{(hasLetter && hasDigitOrSpecial) ? '✓' : '○'}</span>
                  <span>Contains letters and numbers or symbols</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: passwordsMatch ? 'var(--success)' : 'inherit' }}>
                  <span>{passwordsMatch ? '✓' : '○'}</span>
                  <span>Passwords match</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setStep(1)}
                  disabled={loading}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={loading || !hasMinLength || !passwordsMatch || !resetToken.trim()}
                >
                  {loading ? 'Resetting...' : 'Save New Password'}
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'var(--success-bg, rgba(34,197,94,0.15))',
                color: 'var(--success, #22c55e)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem auto'
              }}>
                <CheckCircle2 size={24} />
              </div>
              <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '1rem', fontWeight: 700 }}>Password Reset Complete</h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                Your password has been securely updated and previous sessions revoked. You may now log in with your new credentials.
              </p>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ width: '100%' }}
                onClick={handleClose}
              >
                Return to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
