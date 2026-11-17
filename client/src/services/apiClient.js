import axios from 'axios';

export const ACCESS_TOKEN_KEY = 'elitedist_access_token';
export const REFRESH_TOKEN_KEY = 'elitedist_refresh_token';
export const USER_CACHE_KEY = 'elitedist_user';

export function getStoredToken() {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredTokens({ accessToken, refreshToken } = {}) {
  try {
    if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } catch {
    // Ignore storage quota errors
  }
}

export function clearStoredSession() {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_CACHE_KEY);
  } catch {
    // Ignore storage errors
  }
}

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let refreshPromise = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const requestUrl = originalRequest?.url || '';
    const isAuthEndpoint =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/register') ||
      requestUrl.includes('/auth/refresh');

    if (status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;
      try {
        if (!refreshPromise) {
          const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
          refreshPromise = axios
            .post(
              `${import.meta.env.VITE_API_BASE_URL}/auth/refresh`,
              refreshToken ? { refreshToken } : {},
              { withCredentials: true }
            )
            .finally(() => {
              refreshPromise = null;
            });
        }
        const refreshRes = await refreshPromise;
        const payload = refreshRes.data?.data || refreshRes.data;
        const newAccessToken = payload?.accessToken || payload?.token;
        if (newAccessToken) {
          setStoredTokens({
            accessToken: newAccessToken,
            refreshToken: payload?.refreshToken,
          });
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return apiClient(originalRequest);
        }
      } catch {
        clearStoredSession();
        window.dispatchEvent(new CustomEvent('elitedist:auth-expired'));
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
