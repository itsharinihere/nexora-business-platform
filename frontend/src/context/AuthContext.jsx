import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ApiError, errorMessage, onUnauthorized, tokenStore } from '../services/api';
import { authService, settingsService } from '../services/endpoints';

const AuthContext = createContext(null);

const USER_KEY = 'nexora.user';

function readCachedUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* storage unavailable */
  }
}

/**
 * Authentication state.
 *
 * On mount a cached user is shown immediately (no login flash) and then verified
 * against `GET /auth/me`. A 401 from anywhere in the app drops the session via
 * the `onUnauthorized` hook registered by the API client.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(readCachedUser);
  const [status, setStatus] = useState(() => (readCachedUser() ? 'ready' : 'loading'));
  const [error, setError] = useState(null);

  const persist = useCallback((nextUser, token) => {
    if (token) tokenStore.set(token);
    writeCachedUser(nextUser);
    setUser(nextUser);
    setStatus('ready');
  }, []);

  const signOut = useCallback(
    async ({ notifyServer = true } = {}) => {
      if (notifyServer && tokenStore.get()) {
        try {
          await authService.logout();
        } catch {
          // A failed logout call must never block clearing the local session.
        }
      }
      tokenStore.clear();
      writeCachedUser(null);
      setUser(null);
      setStatus('ready');
    },
    [],
  );

  // Verify the stored token once on mount.
  useEffect(() => {
    let cancelled = false;

    if (!tokenStore.get()) {
      setStatus('ready');
      return undefined;
    }

    (async () => {
      try {
        const data = await authService.me();
        if (!cancelled) persist(data.user);
      } catch (err) {
        if (cancelled) return;
        // An expired or tampered token clears the session silently.
        tokenStore.clear();
        writeCachedUser(null);
        setUser(null);
        setStatus('ready');
        if (!(err instanceof ApiError) || err.status !== 401) setError(errorMessage(err));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [persist]);

  // Let the API client invalidate this session on any 401.
  useEffect(() => {
    onUnauthorized(() => {
      tokenStore.clear();
      writeCachedUser(null);
      setUser(null);
    });
  }, []);

  const signIn = useCallback(
    async (credentials) => {
      setError(null);
      try {
        const data = await authService.login(credentials);
        persist(data.user, data.access_token);
        return data.user;
      } catch (err) {
        setError(errorMessage(err));
        throw err;
      }
    },
    [persist],
  );

  const signUp = useCallback(
    async (payload) => {
      setError(null);
      try {
        const data = await authService.register(payload);
        persist(data.user, data.access_token);
        return data.user;
      } catch (err) {
        setError(errorMessage(err));
        throw err;
      }
    },
    [persist],
  );

  const updateProfile = useCallback(
    async (payload) => {
      const data = await authService.updateProfile(payload);
      persist(data.user);
      return data.user;
    },
    [persist],
  );

  /** Persists a theme choice to the account so it follows the user. */
  const saveAppearance = useCallback(async (theme) => {
    try {
      await settingsService.update({ theme });
    } catch {
      // Appearance is a preference, not business data - never surface a failure.
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      error,
      isAuthenticated: Boolean(user),
      isLoading: status === 'loading',
      isAdmin: user?.role_name === 'admin',
      isManager: user?.role_name === 'admin' || user?.role_name === 'manager',
      permissions: user?.permissions ?? {
        manage_team: false,
        delete_records: false,
        manage_settings: false,
      },
      signIn,
      signUp,
      signOut,
      updateProfile,
      saveAppearance,
      clearError: () => setError(null),
    }),
    [user, status, error, signIn, signUp, signOut, updateProfile, saveAppearance],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}