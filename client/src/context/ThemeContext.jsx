import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

const THEME_STORAGE_KEY = 'elitedist_theme';
const ThemeContext = createContext(null);

function readSavedTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
  } catch {
    // Ignore storage access errors
  }
  return null;
}

function persistThemePreference(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage write errors
  }
}

function resolveInitialTheme() {
  const saved = readSavedTheme();
  if (saved) {
    return saved;
  }
  try {
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {
    // Ignore matchMedia errors
  }
  return 'light';
}

function applyThemeToDocument(theme) {
  if (typeof document === 'undefined') return;
  const isDark = theme === 'dark';
  const root = document.documentElement;
  root.classList.toggle('dark', isDark);
  root.classList.toggle('light', !isDark);
  root.style.colorScheme = isDark ? 'dark' : 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(resolveInitialTheme);
  const shouldPersistRef = useRef(Boolean(readSavedTheme()));

  useEffect(() => {
    applyThemeToDocument(theme);
    if (shouldPersistRef.current) {
      persistThemePreference(theme);
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleSystemThemeChange = (event) => {
      if (!readSavedTheme()) {
        shouldPersistRef.current = false;
        setThemeState(event.matches ? 'dark' : 'light');
      }
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleSystemThemeChange);
      return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
    }
    mediaQuery.addListener(handleSystemThemeChange);
    return () => mediaQuery.removeListener(handleSystemThemeChange);
  }, []);

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
      shouldPersistRef.current = true;
      persistThemePreference(normalized);
      applyWithTransition(() => normalized);
    },
    [applyWithTransition]
  );

  const toggleTheme = useCallback(() => {
    shouldPersistRef.current = true;
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
