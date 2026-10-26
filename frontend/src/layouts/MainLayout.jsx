import React, { useState } from 'react';
import { Sidebar } from '../components/common/Sidebar';
import { Header } from '../components/common/Header';
import { ToastContainer } from '../components/common/ToastContainer';

export const MainLayout = ({ children }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      <div className={`main-wrapper ${isSidebarCollapsed ? 'expanded' : ''}`}>
        <Header onMobileMenuToggle={() => setIsMobileOpen(!isMobileOpen)} />

        <main className="content-container">
          {children}
        </main>
      </div>

      <ToastContainer />
    </div>
  );
};
