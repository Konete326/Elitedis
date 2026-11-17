import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import ComingSoonModal from './ComingSoonModal';
import OnboardingWizardModal from './OnboardingWizardModal';
import ToastContainer from './ToastContainer';

/**
 * Viewport-locked Desktop AppShell (lg:h-dvh lg:overflow-hidden) wrapping
 * Sidebar, Topbar, fluid main workspace, OnboardingWizardModal, ComingSoonModal, and ToastContainer.
 */
export function AppShell({ children, notifications, breadcrumbs }) {
  return (
    <div className="min-h-dvh lg:h-dvh lg:overflow-hidden flex bg-[var(--bg-canvas)] text-[var(--text-primary)] transition-colors duration-200">
      <Sidebar />

      <div className="min-w-0 flex-1 flex flex-col lg:overflow-hidden">
        <Topbar notifications={notifications} breadcrumbs={breadcrumbs} />
        <main className="min-w-0 flex-1 lg:min-h-0 flex flex-col overflow-y-auto overflow-x-hidden lg:overflow-hidden p-3 sm:p-4 lg:p-5">
          {children || <Outlet />}
        </main>
      </div>

      <OnboardingWizardModal />
      <ComingSoonModal />
      <ToastContainer />
    </div>
  );
}

export default AppShell;
