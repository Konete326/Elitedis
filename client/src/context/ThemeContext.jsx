import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';

const THEME_STORAGE_KEY = 'elitedist_theme';
const ThemeContext = createContext(null);

function resolveInitialTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {
    // Ignore storage access errors
  }
  return 'light';
}

function applyThemeToDocument(theme) {
  const isDark = theme === 'dark';
  const root = document.documentElement;
  root.classList.toggle('dark', isDark);
  root.style.colorScheme = isDark ? 'dark' : 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(resolveInitialTheme);

  useEffect(() => {
    applyThemeToDocument(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage write errors
    }
  }, [theme]);

  const applyWithTransition = useCallback((computeNext) => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (typeof document !== 'undefined' && typeof document.startViewTransition === 'function' && !prefersReduced) {
      document.startViewTransition(() => {
        flushSync(() => {
          setThemeState((prev) => {
            const next = computeNext(prev);
            applyThemeToDocument(next);
            return next;
          });
        });
      });
    } else {
      setThemeState(computeNext);
    }
  }, []);

  const setTheme = useCallback(
    (nextTheme) => {
      const normalized = nextTheme === 'dark' ? 'dark' : 'light';
      applyWithTransition(() => normalized);
    },
    [applyWithTransition]
  );

  const toggleTheme = useCallback(() => {
    applyWithTransition((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, [applyWithTransition]);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === 'dark',
      toggleTheme,
      setTheme,
    }),
    [theme, toggleTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default ThemeContext;
