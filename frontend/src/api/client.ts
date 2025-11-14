import axios from 'axios';
import { useAuthStore } from '../store/auth';

const baseURL = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

export const api = axios.create({ baseURL });

// Inject tenantId and session token
api.interceptors.request.use((config) => {
  const { tenantId, sessionToken } = useAuthStore.getState();
  config.headers = config.headers || {};
  if (tenantId) config.headers['x-tenant-id'] = tenantId;
  if (sessionToken) config.headers['x-parse-session-token'] = sessionToken;
  return config;
});

// Global 401/403 handler
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401 || err?.response?.status === 403) {
      useAuthStore.getState().logout();
      // Let route guards redirect to /login
    }
    return Promise.reject(err);
  }
);