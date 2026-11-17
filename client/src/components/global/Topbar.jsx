import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Search, Plus, Bell, Sun, Moon, ChevronRight, X, ClipboardList } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useShell } from '../../context/ShellContext';
import { NAV_GROUPS, EXTRA_QUICK_ROUTES, QUICK_ACTIONS, canAccessNavItem } from './navConfig';

const formatBreadcrumb = (seg) => seg.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

/**
 * Sticky Topbar (z-20, h-14) with sidebar toggle, breadcrumbs, desktop Ctrl+K & mobile
 * Quick Jump search, role-filtered Quick Action launcher, Notification Bell (z-40), and Theme toggle.
 */
export function Topbar({ notifications = [], breadcrumbs: customBreadcrumbs }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const { hasRole, hasWorkPart } = useAuth();
  const { toggleSidebar, isMobileDrawerOpen, openMobileDrawer, closeMobileDrawer } = useShell();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [activeRouteIdx, setActiveRouteIdx] = useState(0);
  const [quickOpen, setQuickOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const searchInputRef = useRef(null);
  const mobileSearchInputRef = useRef(null);
  const searchWrapRef = useRef(null);
  const quickRef = useRef(null);
  const notifRef = useRef(null);
  const isComposingRef = useRef(false);

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (window.innerWidth < 768) {
          setMobileSearchOpen(true);
          setTimeout(() => mobileSearchInputRef.current?.focus(), 40);
        } else {
          searchInputRef.current?.focus();
          setSearchFocused(true);
        }
        setActiveRouteIdx(0);
      } else if (e.key === 'Escape') {
        setSearchFocused(false);
        setMobileSearchOpen(false);
        setQuickOpen(false);
        setNotifOpen(false);
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) setSearchFocused(false);
      if (quickRef.current && !quickRef.current.contains(e.target)) setQuickOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const crumbs = useMemo(() => {
    if (Array.isArray(customBreadcrumbs) && customBreadcrumbs.length > 0) return customBreadcrumbs;
    const parts = location.pathname.split('/').filter(Boolean);
    return parts.map((p, idx) => ({ label: formatBreadcrumb(p), to: `/${parts.slice(0, idx + 1).join('/')}` }));
  }, [customBreadcrumbs, location.pathname]);

  const roleRoutes = useMemo(() => {
    const flatGroupItems = NAV_GROUPS.flatMap((g) =>
      g.items.filter((i) => !i.soon).map((i) => ({ ...i, group: g.key }))
    );
    return [...flatGroupItems, ...EXTRA_QUICK_ROUTES].filter((item) =>
      canAccessNavItem(item, hasRole, hasWorkPart)
    );
  }, [hasRole, hasWorkPart]);

  const matchedRoutes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return roleRoutes.slice(0, 7);
    return roleRoutes
      .filter((r) => r.label.toLowerCase().includes(q) || r.group.toLowerCase().includes(q) || r.to.toLowerCase().includes(q))
      .slice(0, 8);
  }, [roleRoutes, searchQuery]);

  const allowedQuickActions = QUICK_ACTIONS.filter((a) => canAccessNavItem(a, hasRole, hasWorkPart));
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const navigateRoute = (to) => {
    navigate(to);
    setSearchQuery('');
    setSearchFocused(false);
    setMobileSearchOpen(false);
  };

  const handleSearchKeyDown = (e) => {
    if (isComposingRef.current || e.nativeEvent?.isComposing) return;
    if (e.key === 'ArrowDown' && matchedRoutes.length > 0) {
      e.preventDefault();
      setActiveRouteIdx((prev) => (prev + 1) % matchedRoutes.length);
    } else if (e.key === 'ArrowUp' && matchedRoutes.length > 0) {
      e.preventDefault();
      setActiveRouteIdx((prev) => (prev - 1 + matchedRoutes.length) % matchedRoutes.length);
    } else if (e.key === 'Enter' && matchedRoutes.length > 0) {
      e.preventDefault();
      navigateRoute((matchedRoutes[activeRouteIdx] || matchedRoutes[0]).to);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-20 shrink-0 h-14 flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-colors duration-200">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => (isMobileDrawerOpen ? closeMobileDrawer() : openMobileDrawer())}
            aria-label="Toggle mobile menu"
            className="lg:hidden w-10 h-10 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
          >
            <Menu className="w-5 h-5" strokeWidth={1.75} />
          </button>

          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Toggle desktop sidebar"
            className="hidden lg:inline-flex w-9 h-9 rounded-lg items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Menu className="w-5 h-5" strokeWidth={1.75} />
          </button>

          <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs sm:text-sm min-w-0">
            <Link to="/dashboard" className="hidden sm:inline font-medium text-[var(--text-muted)] hover:text-[var(--accent-primary)] shrink-0">
              ELITE DIST
            </Link>
            {crumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.to || idx}>
                <ChevronRight className="hidden sm:inline w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                {idx === crumbs.length - 1 ? (
                  <span className="font-semibold text-[var(--text-primary)] truncate">{crumb.label}</span>
                ) : (
                  <span className="hidden md:inline text-[var(--text-secondary)] truncate">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setMobileSearchOpen((p) => !p);
              setQuickOpen(false);
              setNotifOpen(false);
              setTimeout(() => mobileSearchInputRef.current?.focus(), 40);
            }}
            aria-label="Toggle mobile quick search"
            className="md:hidden w-9 h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-secondary)]"
          >
            <Search className="w-4 h-4" strokeWidth={1.75} />
          </button>

          <div ref={searchWrapRef} className="relative hidden md:block w-56 lg:w-64">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onFocus={() => setSearchFocused(true)}
              onChange={(e) => { setSearchQuery(e.target.value); setActiveRouteIdx(0); }}
              onCompositionStart={() => { isComposingRef.current = true; }}
              onCompositionEnd={() => { isComposingRef.current = false; }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Quick jump..."
              aria-label="Global quick search"
              className="w-full h-9 pl-9 pr-14 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] transition-colors"
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[10px] font-mono text-[var(--text-muted)]">
              Ctrl+K
            </kbd>

            {searchFocused && (
              <div className="animate-scale-in absolute left-0 right-0 mt-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xl z-40 p-1.5">
                {matchedRoutes.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-[var(--text-muted)]">No matching modules</p>
                ) : (
                  matchedRoutes.map((route, idx) => (
                    <button
                      key={route.to}
                      type="button"
                      onMouseEnter={() => setActiveRouteIdx(idx)}
                      onClick={() => navigateRoute(route.to)}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition-colors ${
                        idx === activeRouteIdx ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] font-semibold' : 'hover:bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                      }`}
                    >
                      <span className="font-medium truncate">{route.label}</span>
                      <span className="text-[10px] text-[var(--text-muted)] shrink-0">{route.group}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div ref={quickRef} className="relative">
            <button
              type="button"
              onClick={() => { setQuickOpen((p) => !p); setNotifOpen(false); }}
              className="inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" strokeWidth={2} />
              <span className="hidden sm:inline">Quick Action</span>
            </button>

            {quickOpen && (
              <div className="animate-scale-in absolute right-0 mt-1.5 w-48 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xl z-40 p-1.5">
                {(allowedQuickActions.length > 0 ? allowedQuickActions : [{ label: 'Pending Tasks', to: '/tasks/pending', icon: ClipboardList }]).map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.to}
                      type="button"
                      onClick={() => { setQuickOpen(false); navigate(action.to); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                    >
                      <Icon className="w-4 h-4 text-[var(--accent-primary)]" strokeWidth={1.75} />
                      <span>{action.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div ref={notifRef} className="relative">
            <button
              type="button"
              onClick={() => { setNotifOpen((p) => !p); setQuickOpen(false); }}
              aria-label="Open notifications"
              className="relative w-9 h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-secondary)] transition-colors"
            >
              <Bell className="w-4 h-4" strokeWidth={1.75} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--status-danger)] text-white text-[10px] font-bold tabular-nums flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="animate-scale-in absolute right-0 mt-1.5 w-72 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xl z-40 overflow-hidden">
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--border-subtle)]">
                  <span className="text-xs font-bold text-[var(--text-primary)]">Notifications</span>
                  <span className="text-[11px] tabular-nums text-[var(--text-muted)]">{unreadCount} unread</span>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-[var(--border-subtle)]">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[var(--text-muted)]">No active alerts right now.</div>
                  ) : (
                    notifications.map((n, idx) => (
                      <div key={n._id || idx} className="px-3.5 py-2.5 text-xs">
                        <p className="font-semibold text-[var(--text-primary)]">{n.title}</p>
                        <p className="mt-0.5 text-[var(--text-secondary)]">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            title={isDark ? 'Light Mode (Blue & White)' : 'Dark Mode (Blue & Black)'}
            className="w-9 h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--accent-primary)] transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4" strokeWidth={1.75} /> : <Moon className="w-4 h-4" strokeWidth={1.75} />}
          </button>
        </div>
      </header>

      {mobileSearchOpen && (
        <div className="md:hidden fixed inset-x-0 top-14 z-40 p-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xl animate-slide-up">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={mobileSearchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setActiveRouteIdx(0); }}
                onCompositionStart={() => { isComposingRef.current = true; }}
                onCompositionEnd={() => { isComposingRef.current = false; }}
                onKeyDown={handleSearchKeyDown}
                placeholder="Jump to any page..."
                className="w-full min-h-[42px] pl-9 pr-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              />
            </div>
            <button
              type="button"
              onClick={() => setMobileSearchOpen(false)}
              aria-label="Close mobile search"
              className="w-10 h-10 rounded-lg border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-secondary)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-2 max-h-56 overflow-y-auto divide-y divide-[var(--border-subtle)]">
            {matchedRoutes.map((route) => (
              <button
                key={route.to}
                type="button"
                onClick={() => navigateRoute(route.to)}
                className="w-full flex items-center justify-between gap-2 px-2 py-2.5 text-left text-xs text-[var(--text-primary)]"
              >
                <span className="font-medium truncate">{route.label}</span>
                <span className="text-[10px] text-[var(--text-muted)] shrink-0">{route.group}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default Topbar;
