import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'nexora.theme';
const MODES = ['light', 'dark', 'system'];

/** Resolves the effective theme, collapsing `system` to light or dark. */
function resolve(mode) {
  if (mode !== 'system') return mode;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStoredMode() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return MODES.includes(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

/**
 * Owns the colour theme. The very first paint is handled by an inline script in
 * index.html; this provider keeps React in sync from there on and persists the
 * user's explicit choice to both localStorage and their profile.
 */
export function ThemeProvider({ children, initialPreference = 'system', onPreferenceChange }) {
  const [mode, setMode] = useState(() => readStoredMode() || initialPreference);
  const [resolved, setResolved] = useState(() => resolve(mode));

  // Follow the OS while the user has chosen `system`.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => setResolved(resolve(mode));
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [mode]);

  useEffect(() => {
    const next = resolve(mode);
    setResolved(next);

    const root = document.documentElement;
    root.classList.toggle('dark', next === 'dark');
    root.style.colorScheme = next;

    const meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (meta) meta.setAttribute('content', next === 'dark' ? '#0b1020' : '#4f46e5');

    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* storage unavailable */
    }

    onPreferenceChange?.(mode);
  }, [mode, onPreferenceChange]);

  const setTheme = useCallback((next) => {
    setMode(MODES.includes(next) ? next : 'system');
  }, []);

  const toggleTheme = useCallback(() => {
    setMode((current) => {
      const active = resolve(current);
      return active === 'dark' ? 'light' : 'dark';
    });
  }, []);

  const value = useMemo(
    () => ({ mode, resolvedTheme: resolved, setTheme, toggleTheme, isDark: resolved === 'dark' }),
    [mode, resolved, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>.');
  return context;
}