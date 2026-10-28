import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

const AuthContext = createContext(null);

const SESSION_STORAGE_KEY = 'smartprice_session';

export const AuthProvider = ({ children }) => {
  // Check existing session from localStorage (valid only if not expired)
  const getInitialSession = () => {
    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const expiry = parsed?.expires_at || parsed?.expiresAt;
        if (parsed?.token && parsed?.user && (!expiry || expiry > Date.now())) {
          return parsed;
        } else {
          localStorage.removeItem(SESSION_STORAGE_KEY);
          localStorage.removeItem('smartprice_user');
          localStorage.removeItem('smartprice_auth');
        }
      }
    } catch (e) {
      console.error('Failed to parse auth session from localStorage:', e);
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
    return null;
  };

  const initialSession = getInitialSession();
  const [user, setUser] = useState(initialSession ? initialSession.user : null);
  const [isAuthenticated, setIsAuthenticated] = useState(!!initialSession);
  const [loading, setLoading] = useState(false);

  // Automatically clean up state if token is rejected by backend (401 Unauthorized)
  useEffect(() => {
    const handleAuthExpired = (e) => {
      console.warn('[AuthContext] Session expired or invalid token rejected by backend:', e?.detail?.reason);
      clearSession();
    };
    window.addEventListener('smartprice_auth_expired', handleAuthExpired);
    return () => window.removeEventListener('smartprice_auth_expired', handleAuthExpired);
  }, []);

  // Sync session changes
  const saveSession = (sessionData) => {
    if (sessionData && sessionData.token) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
      localStorage.setItem('smartprice_user', JSON.stringify(sessionData.user));
      localStorage.setItem('smartprice_auth', 'true');
      setUser(sessionData.user);
      setIsAuthenticated(true);
    }
  };

  const clearSession = () => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem('smartprice_user');
    localStorage.removeItem('smartprice_auth');
    setUser(null);
    setIsAuthenticated(false);
  };

  // Direct password-based login
  const login = async (credentials) => {
    setLoading(true);
    try {
      const response = await apiService.login(credentials);
      if (response && response.session) {
        saveSession(response.session);
        return response;
      }
      throw new Error(response?.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Compatibility helpers (direct authentication without OTP)
  const verifyLoginOtp = async (verifyData) => {
    return login(verifyData);
  };

  const resendLoginOtp = async () => {
    return { success: true };
  };

  // Direct register
  const register = async (registrationData) => {
    setLoading(true);
    try {
      const response = await apiService.register(registrationData);
      if (response && response.session) {
        saveSession(response.session);
      }
      return response;
    } finally {
      setLoading(false);
    }
  };

  // Quick Profile Helper (loads trusted identity without exposing hardcoded passwords)
  const getProfileIdentifier = (role = 'Retail Pricing Manager') => {
    if (role === 'Senior Merchandising Analyst') {
      return 'analyst.sarah@smartprice.ai';
    } else if (role === 'Store Operations Director') {
      return 'marcus.vance@smartprice.ai';
    }
    return 'pradeep.retail@smartprice.ai';
  };

  const loginWithProfile = async (role = 'Retail Pricing Manager', password = '') => {
    const identifier = getProfileIdentifier(role);
    if (!password) {
      throw new Error('Please enter the password for this profile.');
    }
    return login({ identifier, password, role });
  };

  // Password Management Handlers
  const changePassword = async (currentPassword, newPassword, confirmPassword) => {
    setLoading(true);
    try {
      const res = await apiService.changePassword(currentPassword, newPassword, confirmPassword);
      return res;
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = async (identifier) => {
    return await apiService.forgotPassword(identifier);
  };

  const resetPassword = async (token, newPassword, confirmPassword) => {
    return await apiService.resetPassword(token, newPassword, confirmPassword);
  };

  // Logout & invalidate session
  const logout = () => {
    clearSession();
    try {
      fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    } catch (e) {
      // ignore
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        loading,
        login,
        verifyLoginOtp,
        resendLoginOtp,
        register,
        loginWithProfile,
        forgotPassword,
        resetPassword,
        changePassword,
        logout,
        setIsAuthenticated
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
