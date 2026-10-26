import React, { useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StoreProvider, useStore } from './context/StoreContext';
import { MainLayout } from './layouts/MainLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { DemandForecastPage } from './pages/DemandForecastPage';
import { PriceOptimizationPage } from './pages/PriceOptimizationPage';
import { WhatIfAnalysisPage } from './pages/WhatIfAnalysisPage';
import { InventoryPage } from './pages/InventoryPage';
import { AiInsightsPage } from './pages/AiInsightsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProductsPage } from './pages/ProductsPage';
import { CommandPalette } from './components/common/CommandPalette';
import { KeyboardShortcutsModal } from './components/common/KeyboardShortcutsModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';

function AppContent() {
  const { isAuthenticated } = useAuth();
  const {
    activePage,
    navigateTo,
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    toggleCommandPalette,
    isShortcutsModalOpen,
    setIsShortcutsModalOpen,
    toggleShortcutsModal,
    undoLastAction
  } = useStore();

  // Global Keyboard Navigation & Shortcut listeners
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable;

      // ⌘K / Ctrl+K Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleCommandPalette();
        return;
      }

      // ⌘Z / Ctrl+Z Undo
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !isInput) {
        e.preventDefault();
        undoLastAction();
        return;
      }

      // Esc dismiss
      if (e.key === 'Escape') {
        if (isCommandPaletteOpen) setIsCommandPaletteOpen(false);
        if (isShortcutsModalOpen) setIsShortcutsModalOpen(false);
        return;
      }

      // Direct page navigation when outside inputs
      if (!isInput && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key === '?') {
          e.preventDefault();
          toggleShortcutsModal();
        } else if (e.key === '1') {
          navigateTo('dashboard');
        } else if (e.key === '2') {
          navigateTo('forecast');
        } else if (e.key === '3') {
          navigateTo('optimization');
        } else if (e.key === '4') {
          navigateTo('what-if');
        } else if (e.key === '5') {
          navigateTo('inventory');
        } else if (e.key === '6') {
          navigateTo('products');
        } else if (e.key === '7') {
          navigateTo('ai-insights');
        } else if (e.key === '8') {
          navigateTo('reports');
        } else if (e.key === '9') {
          navigateTo('settings');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isCommandPaletteOpen,
    isShortcutsModalOpen,
    toggleCommandPalette,
    toggleShortcutsModal,
    setIsCommandPaletteOpen,
    setIsShortcutsModalOpen,
    navigateTo,
    undoLastAction
  ]);

  // Route guard & URL protection
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const currentPath = window.location.pathname;

    if (!isAuthenticated) {
      // Unauthenticated user attempting to access root or any protected route
      if (currentPath !== '/login') {
        window.history.replaceState(null, '', '/login');
      }
    } else {
      // Authenticated user on /login or root / -> redirect to /dashboard
      if (currentPath === '/login' || currentPath === '/') {
        navigateTo('dashboard', {}, { replace: true });
      }
    }
  }, [isAuthenticated, navigateTo]);

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => navigateTo('dashboard')} />;
  }

  const renderActivePage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'forecast':
        return <DemandForecastPage />;
      case 'optimization':
        return <PriceOptimizationPage />;
      case 'what-if':
        return <WhatIfAnalysisPage />;
      case 'inventory':
        return <InventoryPage />;
      case 'products':
        return <ProductsPage />;
      case 'ai-insights':
        return <AiInsightsPage />;
      case 'reports':
        return <ReportsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <MainLayout>
      <ErrorBoundary onNavigateHome={() => navigateTo('dashboard')}>
        {renderActivePage()}
      </ErrorBoundary>
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />
    </MainLayout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <StoreProvider>
          <AppContent />
        </StoreProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
