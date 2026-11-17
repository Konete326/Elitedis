import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient, {
  USER_CACHE_KEY,
  clearStoredSession,
  getStoredToken,
  setStoredTokens,
} from '../services/apiClient';

const AuthContext = createContext(null);

const ROLE_HOME_MAP = {
  SUPER_ADMIN: '/dashboard',
  ADMIN: '/dashboard',
  WAREHOUSE_MANAGER: '/dashboard',
  ACCOUNTANT: '/dashboard',
  BOOKER: '/portal/booker',
  POS_OPERATOR: '/portal/pos',
  SALESMAN: '/portal/salesman',
  STOREKEEPER: '/tasks/pending',
};

function readCachedUser() {
  try {
    const token = getStoredToken();
    if (!token) return null;
    const raw = localStorage.getItem(USER_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user) {
  try {
    if (user) {
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_CACHE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState(getStoredToken);
  const [user, setUser] = useState(readCachedUser);

  const meQuery = useQuery({
    queryKey: ['auth-me', token],
    queryFn: async () => {
      const response = await apiClient.get('/auth/me');
      const resolvedUser = response.data?.data?.user || response.data?.data || response.data?.user;
      if (resolvedUser) {
        writeCachedUser(resolvedUser);
        setUser(resolvedUser);
      }
      return resolvedUser;
    },
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    const handleAuthExpired = () => {
      clearStoredSession();
      setToken('');
      setUser(null);
      queryClient.clear();
    };
    window.addEventListener('elitedist:auth-expired', handleAuthExpired);
    return () => window.removeEventListener('elitedist:auth-expired', handleAuthExpired);
  }, [queryClient]);

  const getRoleHomeRoute = useCallback(
    (roleOrUser) => {
      const role =
        typeof roleOrUser === 'string'
          ? roleOrUser
          : roleOrUser?.primaryRole || user?.primaryRole;
      return ROLE_HOME_MAP[role] || '/dashboard';
    },
    [user]
  );

  const login = useCallback(
    async (credentials) => {
      const response = await apiClient.post('/auth/login', credentials);
      const payload = response.data?.data || response.data;
      const nextToken = payload?.accessToken || payload?.token || '';
      const nextRefresh = payload?.refreshToken || '';
      const nextUser = payload?.user || null;

      setStoredTokens({ accessToken: nextToken, refreshToken: nextRefresh });
      writeCachedUser(nextUser);
      setToken(nextToken);
      setUser(nextUser);
      queryClient.setQueryData(['auth-me', nextToken], nextUser);

      return {
        user: nextUser,
        token: nextToken,
        homeRoute: ROLE_HOME_MAP[nextUser?.primaryRole] || '/dashboard',
      };
    },
    [queryClient]
  );

  const register = useCallback(
    async (payloadInput) => {
      const response = await apiClient.post('/auth/register', payloadInput);
      const payload = response.data?.data || response.data;
      const nextToken = payload?.accessToken || payload?.token || '';
      const nextRefresh = payload?.refreshToken || '';
      const nextUser = payload?.user || null;

      if (nextToken && nextUser) {
        setStoredTokens({ accessToken: nextToken, refreshToken: nextRefresh });
        writeCachedUser(nextUser);
        setToken(nextToken);
        setUser(nextUser);
        queryClient.setQueryData(['auth-me', nextToken], nextUser);
      }

      return {
        user: nextUser,
        token: nextToken,
        homeRoute: ROLE_HOME_MAP[nextUser?.primaryRole] || '/dashboard',
      };
    },
    [queryClient]
  );

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Proceed with local cleanup even if network call fails
    } finally {
      clearStoredSession();
      setToken('');
      setUser(null);
      queryClient.clear();
    }
  }, [queryClient]);

  const hasRole = useCallback(
    (...allowedRoles) => {
      const roles = allowedRoles.flat().filter(Boolean);
      if (roles.length === 0) return true;
      return Boolean(user?.primaryRole && roles.includes(user.primaryRole));
    },
    [user]
  );

  const hasWorkPart = useCallback(
    (workPartKey) => {
      if (!workPartKey) return true;
      if (user?.primaryRole === 'SUPER_ADMIN') return true;
      return Boolean(user?.workParts?.[workPartKey]);
    },
    [user]
  );

  const resolvedUser = meQuery.data || user;
  const isAuthenticated = Boolean(token && resolvedUser);
  const isLoading = Boolean(token && !resolvedUser && meQuery.isPending);

  const value = useMemo(
    () => ({
      user: resolvedUser,
      token,
      isAuthenticated,
      isLoading,
      login,
      register,
      logout,
      hasRole,
      hasWorkPart,
      getRoleHomeRoute,
    }),
    [resolvedUser, token, isAuthenticated, isLoading, login, register, logout, hasRole, hasWorkPart, getRoleHomeRoute]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
