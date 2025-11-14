import { create } from 'zustand';

type Role = 'Admin' | 'Teacher' | 'Student' | null;

type User = {
  username?: string;
  role?: Role;
  tenantId?: string;
  [k: string]: unknown;
} | null;

type AuthState = {
  tenantId: string | null;
  sessionToken: string | null;
  role: Role;
  user: User;
  setAuth: (p: { tenantId: string; sessionToken: string; role: Role; user: User }) => void;
  logout: () => void;
  hydrate: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  tenantId: null,
  sessionToken: null,
  role: null,
  user: null,
  setAuth: ({ tenantId, sessionToken, role, user }) => {
    const payload = { tenantId, sessionToken, role, user };
    localStorage.setItem('auth', JSON.stringify(payload));
    set(payload);
  },
  logout: () => {
    localStorage.removeItem('auth');
    set({ tenantId: null, sessionToken: null, role: null, user: null });
  },
  hydrate: () => {
    try {
      const raw = localStorage.getItem('auth');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      set(parsed);
    } catch {
      // ignore
    }
  },
}));