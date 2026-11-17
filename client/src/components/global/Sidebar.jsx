import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, X, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useShell } from '../../context/ShellContext';
import ConfirmModal from './ConfirmModal';
import { NAV_GROUPS, canAccessNavItem } from './navConfig';

function BrandLogo() {
  return (
    <svg viewBox="0 0 36 36" className="w-8 h-8 shrink-0" aria-hidden="true">
      <defs>
        <linearGradient id="eliteRibbonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0284C7" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="9" fill="url(#eliteRibbonGrad)" />
      <path d="M9 11h18l-2.5 4H12.5v3.5h11l-2 3.5H12.5V25H26l-2.5 3.5H9V11z" fill="#FFFFFF" />
    </svg>
  );
}

/**
 * Role-isolated collapsible Sidebar with desktop collapse (z-30), mobile drawer (z-40),
 * strict panel isolation, and ConfirmModal before logout.
 */
export function Sidebar() {
  const navigate = useNavigate();
  const { user, hasRole, hasWorkPart, logout } = useAuth();
  const {
    isSidebarCollapsed,
    isMobileDrawerOpen,
    closeMobileDrawer,
    navGroups,
    toggleNavGroup,
    openComingSoon,
  } = useShell();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  useEffect(() => {
    if (!isMobileDrawerOpen) return undefined;
    const onKeyDown = (e) => e.key === 'Escape' && closeMobileDrawer();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobileDrawerOpen, closeMobileDrawer]);

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canAccessNavItem(item, hasRole, hasWorkPart)),
  })).filter((group) => group.items.length > 0);

  const roleLabel = (user?.primaryRole || 'STAFF').replace(/_/g, ' ');

  const confirmLogout = async () => {
    setLogoutConfirmOpen(false);
    await logout();
    navigate('/auth/login', { replace: true });
  };

  const renderBody = (isMobile = false) => (
    <div className="flex flex-col h-full w-64 bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] transition-colors duration-200">
      <div className="shrink-0 flex items-center justify-between gap-2 px-4 h-14 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2.5 min-w-0">
          <BrandLogo />
          <div className="min-w-0">
            <p className="text-sm font-extrabold tracking-tight text-[var(--text-primary)] truncate">
              ELITE DIST
            </p>
            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-[var(--accent-soft)] text-[var(--accent-primary)] truncate">
              {roleLabel}
            </span>
          </div>
        </div>
        {isMobile && (
          <button
            type="button"
            onClick={closeMobileDrawer}
            aria-label="Close navigation menu"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
          >
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        )}
      </div>

      <nav aria-label="Primary navigation" className="flex-1 min-h-0 overflow-y-auto px-2.5 py-3 space-y-2">
        {visibleGroups.map((group) => {
          const isOpen = navGroups?.[group.key] ?? true;
          return (
            <div key={group.key} className="space-y-0.5">
              <button
                type="button"
                onClick={() => toggleNavGroup(group.key)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/60 transition-colors"
              >
                <span className="truncate">{group.key}</span>
                {isOpen ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
              </button>

              {isOpen && (
                <div className="space-y-0.5 pl-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    if (item.soon) {
                      return (
                        <button
                          key={item.to}
                          type="button"
                          onClick={() => {
                            if (isMobile) closeMobileDrawer();
                            openComingSoon({ title: item.label, phase: item.phase, description: `${item.label} is scheduled in ${item.phase}.` });
                          }}
                          className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <Icon className="w-4 h-4 shrink-0 text-[var(--text-muted)]" strokeWidth={1.75} />
                            <span className="truncate">{item.label}</span>
                          </span>
                          <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                            Soon
                          </span>
                        </button>
                      );
                    }
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => isMobile && closeMobileDrawer()}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                            isActive
                              ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] font-semibold'
                              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                          }`
                        }
                      >
                        <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                        <span className="truncate" title={item.label}>{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 p-3 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{user?.fullName || 'Operator'}</p>
          <p className="text-[11px] font-mono text-[var(--text-muted)] truncate">
            {user?.profileId || user?.distributorId || 'ELITE-DIST'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setLogoutConfirmOpen(true)}
          title="Sign out"
          aria-label="Sign out"
          className="shrink-0 w-9 h-9 rounded-lg border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--status-danger)] hover:bg-[var(--status-danger)]/10 transition-colors"
        >
          <LogOut className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside
        aria-label="Desktop sidebar"
        className={`hidden lg:block shrink-0 z-30 h-dvh overflow-hidden transition-all duration-200 ease-out ${
          isSidebarCollapsed ? 'w-0 -translate-x-full opacity-0 invisible pointer-events-none' : 'w-64 translate-x-0 opacity-100'
        }`}
      >
        {renderBody(false)}
      </aside>

      {isMobileDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div aria-hidden="true" onClick={closeMobileDrawer} className="fixed inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm animate-fade-in" />
          <aside aria-label="Mobile navigation drawer" className="relative z-40 h-full max-w-[85vw] animate-drawer-left">
            {renderBody(true)}
          </aside>
        </div>
      )}

      <ConfirmModal
        isOpen={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        onConfirm={confirmLogout}
        title="Sign Out of ELITE DIST?"
        message="You will be logged out of your active session and need to sign in again."
        confirmLabel="Sign Out"
        variant="warning"
      />
    </>
  );
}

export default Sidebar;
