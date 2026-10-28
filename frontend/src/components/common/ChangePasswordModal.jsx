import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { soundEffects } from '../../utils/soundEffects';

export const ChangePasswordModal = ({ isOpen, onClose, onSuccess }) => {
  const { user, changePassword } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const hasMinLength = newPassword.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const hasDigitOrSpecial = /[0-9]|[^a-zA-Z0-9]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword) {
      setError('Please enter your current password.');
      soundEffects?.playAlert?.();
      return;
    }

    if (!hasMinLength) {
      setError('New password must be at least 8 characters long.');
      soundEffects?.playAlert?.();
      return;
    }

    if (!hasLetter || !hasDigitOrSpecial) {
      setError('New password must contain at least one letter and at least one number or special character.');
      soundEffects?.playAlert?.();
      return;
    }

    if (!passwordsMatch) {
      setError('New password and confirmation password do not match.');
      soundEffects?.playAlert?.();
      return;
    }

    if (currentPassword === newPassword) {
      setError('New password cannot be identical to your current password.');
      soundEffects?.playAlert?.();
      return;
    }

    setLoading(true);
    try {
      const res = await changePassword(currentPassword, newPassword, confirmPassword);
      setSuccess(res?.message || 'Password changed successfully. Prior sessions have been revoked.');
      soundEffects?.playSuccess?.();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err?.message || 'Failed to update password.');
      soundEffects?.playAlert?.();
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    setSuccess('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    onClose();
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }}>
      <div className="modal-content" style={{ maxWidth: '440px', width: '90%' }}>
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
              <Lock size={16} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Change Password</h3>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                {user?.identifier || user?.email || 'Account Security'}
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

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: '1.25rem' }}>
            {error && (
              <div className="alert-banner alert-danger" style={{ marginBottom: '1rem', fontSize: '0.78rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="alert-banner alert-success" style={{ marginBottom: '1rem', fontSize: '0.78rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                <span>{success}</span>
              </div>
            )}

            {/* Current Password */}
            <div className="form-group" style={{ marginBottom: '0.85rem' }}>
              <label className="form-label" style={{ fontSize: '0.78rem' }}>Current Password</label>
              <div className="login-input-wrapper" style={{ position: 'relative' }}>
                <input
                  type={showCurrent ? 'text' : 'password'}
                  className="form-input"
                  style={{ width: '100%', paddingRight: '2.5rem' }}
                  value={currentPassword}
                  onChange={(e) => { setCurrentPassword(e.target.value); setError(''); }}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
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
                  {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="form-group" style={{ marginBottom: '0.85rem' }}>
              <label className="form-label" style={{ fontSize: '0.78rem' }}>New Password</label>
              <div className="login-input-wrapper" style={{ position: 'relative' }}>
                <input
                  type={showNew ? 'text' : 'password'}
                  className="form-input"
                  style={{ width: '100%', paddingRight: '2.5rem' }}
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                  placeholder="Minimum 8 characters"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
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
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div className="form-group" style={{ marginBottom: '0.85rem' }}>
              <label className="form-label" style={{ fontSize: '0.78rem' }}>Confirm New Password</label>
              <input
                type={showNew ? 'text' : 'password'}
                className="form-input"
                style={{ width: '100%' }}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                placeholder="Re-enter new password"
                autoComplete="new-password"
                required
              />
            </div>

            {/* Complexity Indicators */}
            <div style={{
              background: 'var(--bg-card-subtle, rgba(255,255,255,0.03))',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.6rem 0.8rem',
              fontSize: '0.72rem',
              color: 'var(--text-secondary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: hasMinLength ? 'var(--success)' : 'inherit' }}>
                <span style={{ fontWeight: 700 }}>{hasMinLength ? '✓' : '○'}</span>
                <span>At least 8 characters</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: (hasLetter && hasDigitOrSpecial) ? 'var(--success)' : 'inherit' }}>
                <span style={{ fontWeight: 700 }}>{(hasLetter && hasDigitOrSpecial) ? '✓' : '○'}</span>
                <span>Contains letters and numbers or symbols</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: passwordsMatch ? 'var(--success)' : 'inherit' }}>
                <span style={{ fontWeight: 700 }}>{passwordsMatch ? '✓' : '○'}</span>
                <span>Passwords match</span>
              </div>
            </div>

            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.65rem' }}>
              🔒 Updating your password will immediately revoke active sessions on all other devices.
            </div>
          </div>

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', padding: '0.75rem 1.25rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={loading || !hasMinLength || !passwordsMatch}
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
