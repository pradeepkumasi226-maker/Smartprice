import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const THEME_STORAGE_KEY = 'smartprice-theme';
const THEMES = {
  DARK: 'dark',
  LIGHT: 'light',
};
const DEFAULT_THEME = THEMES.DARK;

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────
const ThemeContext = createContext(null);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Read persisted theme from localStorage, falling back to DEFAULT_THEME. */
function getStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === THEMES.LIGHT || stored === THEMES.DARK) return stored;
  } catch {
    // localStorage unavailable (e.g. private browsing with restrictions)
  }
  return DEFAULT_THEME;
}

/** Apply the theme attribute to the document root element. */
function applyThemeToDOM(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────
export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    const initial = getStoredTheme();
    // Apply immediately so there's no flash of wrong theme on first render
    applyThemeToDOM(initial);
    return initial;
  });

  // Sync DOM whenever theme state changes
  useEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  /**
   * Change the active theme.
   * @param {'dark'|'light'} newTheme
   */
  const setTheme = useCallback((newTheme) => {
    if (newTheme !== THEMES.DARK && newTheme !== THEMES.LIGHT) return;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // ignore write errors
    }
    setThemeState(newTheme);
  }, []);

  /** Toggle between dark and light. */
  const toggleTheme = useCallback(() => {
    setTheme(theme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK);
  }, [theme, setTheme]);

  const value = {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === THEMES.DARK,
    isLight: theme === THEMES.LIGHT,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────
export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
};

export { THEMES };
