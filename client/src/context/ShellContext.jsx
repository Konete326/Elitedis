import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';

const SIDEBAR_STORAGE_KEY = 'elitedist_sidebar_collapsed';
const NAV_GROUPS_STORAGE_KEY = 'elitedist_nav_groups';

const ShellContext = createContext(null);

function readBoolStorage(key, fallback = false) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === 'true';
  } catch {
    return fallback;
  }
}

function readJsonStorage(key, fallback = {}) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function ShellProvider({ children }) {
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() =>
    readBoolStorage(SIDEBAR_STORAGE_KEY, false)
  );
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [navGroups, setNavGroups] = useState(() =>
    readJsonStorage(NAV_GROUPS_STORAGE_KEY, {})
  );
  const [comingSoonState, setComingSoonState] = useState({
    isOpen: false,
    title: '',
    description: '',
    phase: '',
  });
  const [toasts, setToasts] = useState([]);
  const scrollLockCountRef = useRef(0);
  const toastTimersRef = useRef(new Map());

  const lockScroll = useCallback(() => {
    scrollLockCountRef.current += 1;
    document.body.style.overflow = 'hidden';
  }, []);

  const unlockScroll = useCallback(() => {
    scrollLockCountRef.current = Math.max(0, scrollLockCountRef.current - 1);
    if (scrollLockCountRef.current === 0) {
      document.body.style.overflow = '';
    }
  }, []);

  useEffect(() => {
    setIsMobileDrawerOpen(false);
    setComingSoonState((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
    scrollLockCountRef.current = 0;
    document.body.style.overflow = '';
  }, [location.pathname]);

  useEffect(() => {
    const timers = toastTimersRef.current;
    return () => {
      document.body.style.overflow = '';
      timers.forEach((timerId) => clearTimeout(timerId));
      timers.clear();
    };
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage errors
      }
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 220);
      return next;
    });
  }, []);

  const openMobileDrawer = useCallback(() => {
    setIsMobileDrawerOpen(true);
    lockScroll();
  }, [lockScroll]);

  const closeMobileDrawer = useCallback(() => {
    setIsMobileDrawerOpen((prev) => {
      if (prev) unlockScroll();
      return false;
    });
  }, [unlockScroll]);

  const toggleNavGroup = useCallback((groupKey) => {
    if (!groupKey) return;
    setNavGroups((prev) => {
      const current = prev[groupKey] ?? true;
      const next = { ...prev, [groupKey]: !current };
      try {
        localStorage.setItem(NAV_GROUPS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  const openComingSoon = useCallback(
    (payload) => {
      const details =
        typeof payload === 'string'
          ? { title: payload, description: '', phase: '' }
          : {
              title: payload?.title || payload?.featureName || 'Scheduled Module',
              description: payload?.description || '',
              phase: payload?.phase || '',
            };
      setComingSoonState((prev) => {
        if (!prev.isOpen) lockScroll();
        return { isOpen: true, ...details };
      });
    },
    [lockScroll]
  );

  const closeComingSoon = useCallback(() => {
    setComingSoonState((prev) => {
      if (prev.isOpen) unlockScroll();
      return { ...prev, isOpen: false };
    });
  }, [unlockScroll]);

  const removeToast = useCallback((id) => {
    const timer = toastTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const addToast = useCallback(
    (input, fallbackType = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const normalized =
        typeof input === 'string'
          ? { id, type: fallbackType, title: '', message: input, duration: 4500 }
          : {
              id,
              type: input?.type || 'info',
              title: input?.title || '',
              message: input?.message || '',
              duration: input?.duration ?? 4500,
            };

      setToasts((prev) => [...prev.slice(-4), normalized]);

      if (normalized.duration > 0) {
        const timerId = setTimeout(() => {
          removeToast(id);
        }, normalized.duration);
        toastTimersRef.current.set(id, timerId);
      }
      return id;
    },
    [removeToast]
  );

  const value = useMemo(
    () => ({
      isSidebarCollapsed,
      toggleSidebar,
      isMobileDrawerOpen,
      openMobileDrawer,
      closeMobileDrawer,
      navGroups,
      toggleNavGroup,
      comingSoonState,
      openComingSoon,
      closeComingSoon,
      toasts,
      addToast,
      removeToast,
      lockScroll,
      unlockScroll,
    }),
    [
      isSidebarCollapsed,
      toggleSidebar,
      isMobileDrawerOpen,
      openMobileDrawer,
      closeMobileDrawer,
      navGroups,
      toggleNavGroup,
      comingSoonState,
      openComingSoon,
      closeComingSoon,
      toasts,
      addToast,
      removeToast,
      lockScroll,
      unlockScroll,
    ]
  );

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell() {
  const context = useContext(ShellContext);
  if (!context) {
    throw new Error('useShell must be used within a ShellProvider');
  }
  return context;
}

export default ShellContext;
