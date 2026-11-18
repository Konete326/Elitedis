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
      const data = response.data?.data || response.data;
      const resolvedUser = data?.user || data;
      const resolvedAgency = data?.agencyProfile || resolvedUser?.agencyProfile || null;
      if (resolvedUser) {
        writeCachedUser(resolvedUser);
        setUser(resolvedUser);
      }
      if (resolvedAgency) {
        queryClient.setQueryData(['agency-profile', resolvedUser?.distributorId || 'default'], resolvedAgency);
      }
      return resolvedUser;
    },
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const resolvedUser = meQuery.data || user;
  const activeDistributorId = resolvedUser?.distributorId || 'default';

  const agencyQuery = useQuery({
    queryKey: ['agency-profile', activeDistributorId],
    queryFn: async () => {
      const response = await apiClient.get('/auth/agency-profile');
      return response.data?.data || response.data || null;
    },
    enabled: Boolean(token && resolvedUser),
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
          : roleOrUser?.primaryRole || resolvedUser?.primaryRole;
      return ROLE_HOME_MAP[role] || '/dashboard';
    },
    [resolvedUser]
  );

  const applySessionPayload = useCallback(
    (payload) => {
      const nextToken = payload?.accessToken || payload?.token || '';
      const nextRefresh = payload?.refreshToken || '';
      const nextUser = payload?.user || null;
      const nextAgency = payload?.agencyProfile || nextUser?.agencyProfile || null;

      if (nextToken && nextUser) {
        setStoredTokens({ accessToken: nextToken, refreshToken: nextRefresh });
        writeCachedUser(nextUser);
        setToken(nextToken);
        setUser(nextUser);
        queryClient.setQueryData(['auth-me', nextToken], nextUser);
        if (nextAgency) {
          queryClient.setQueryData(['agency-profile', nextUser?.distributorId || 'default'], nextAgency);
        }
      }
      return {
        user: nextUser,
        agencyProfile: nextAgency,
        token: nextToken,
        homeRoute: ROLE_HOME_MAP[nextUser?.primaryRole] || '/dashboard',
      };
    },
    [queryClient]
  );

  const login = useCallback(
    async (credentials) => {
      const response = await apiClient.post('/auth/login', credentials);
      return applySessionPayload(response.data?.data || response.data);
    },
    [applySessionPayload]
  );

  const register = useCallback(
    async (payloadInput) => {
      const response = await apiClient.post('/auth/register', payloadInput);
      return applySessionPayload(response.data?.data || response.data);
    },
    [applySessionPayload]
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

  const refreshAgencyProfile = useCallback(async () => {
    const res = await agencyQuery.refetch();
    return res.data || null;
  }, [agencyQuery.refetch]);

  const updateAgencyProfile = useCallback(
    async (payload) => {
      const response = await apiClient.put('/auth/agency-profile', payload);
      const updated = response.data?.data || response.data;
      queryClient.setQueryData(['agency-profile', activeDistributorId], updated);
      queryClient.invalidateQueries({ queryKey: ['print-templates'] });
      return updated;
    },
    [activeDistributorId, queryClient]
  );

  const skipAgencyOnboarding = useCallback(async () => {
    const response = await apiClient.post('/auth/agency-profile/skip');
    const current = queryClient.getQueryData(['agency-profile', activeDistributorId]) || {};
    const updated = response.data?.data || {
      ...current,
      onboardingSkipped: true,
    };
    queryClient.setQueryData(['agency-profile', activeDistributorId], updated);
    return updated;
  }, [activeDistributorId, queryClient]);

  const hasRole = useCallback(
    (...allowedRoles) => {
      const roles = allowedRoles.flat().filter(Boolean);
      if (roles.length === 0) return true;
      return Boolean(resolvedUser?.primaryRole && roles.includes(resolvedUser.primaryRole));
    },
    [resolvedUser]
  );

  const hasWorkPart = useCallback(
    (workPartKey) => {
      if (!workPartKey) return true;
      if (resolvedUser?.primaryRole === 'SUPER_ADMIN') return true;
      return Boolean(resolvedUser?.workParts?.[workPartKey]);
    },
    [resolvedUser]
  );

  const isAuthenticated = Boolean(token && resolvedUser);
  const isLoading = Boolean(token && !resolvedUser && meQuery.isPending);
  const agencyProfile = agencyQuery.data || null;
  const canViewPurchasePrice = Boolean(
    resolvedUser &&
      (resolvedUser.primaryRole === 'SUPER_ADMIN' ||
        resolvedUser.primaryRole === 'ADMIN' ||
        resolvedUser.permissions?.purchasePriceVisibility === true)
  );

  const value = useMemo(
    () => ({
      user: resolvedUser,
      token,
      agencyProfile,
      isAuthenticated,
      isLoading,
      canViewPurchasePrice,
      login,
      register,
      logout,
      refreshAgencyProfile,
      updateAgencyProfile,
      skipAgencyOnboarding,
      hasRole,
      hasWorkPart,
      getRoleHomeRoute,
    }),
    [
      resolvedUser,
      token,
      agencyProfile,
      isAuthenticated,
      isLoading,
      canViewPurchasePrice,
      login,
      register,
      logout,
      refreshAgencyProfile,
      updateAgencyProfile,
      skipAgencyOnboarding,
      hasRole,
      hasWorkPart,
      getRoleHomeRoute,
    ]
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
