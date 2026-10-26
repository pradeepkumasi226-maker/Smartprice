import React, { createContext, useContext, useState } from 'react';
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
        if (parsed?.token && parsed?.user && (!parsed.expiresAt || parsed.expiresAt > Date.now())) {
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

  // Direct login
  const login = async (credentials) => {
    setLoading(true);
    try {
      const response = await apiService.login(credentials);
      if (response && response.session) {
        saveSession(response.session);
        return response;
      }
      throw new Error('Login failed. Please try again.');
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
        loginWithProfile,
        logout,
        setIsAuthenticated
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
