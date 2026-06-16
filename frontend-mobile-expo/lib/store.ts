import { create } from 'zustand';
import type { User } from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
}

interface ChatIntent {
  documentId?: string;
  prefill?: string;
}

interface AppStore {
  // Auth
  auth: AuthState;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setAuthLoading: (isLoading: boolean) => void;
  logout: () => void;

  // Navigation
  navIndex: number;
  setNavIndex: (index: number) => void;

  // Chat intent (deep-link into chat from other screens)
  chatIntent: ChatIntent | null;
  setChatIntent: (intent: ChatIntent | null) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppStore>((set) => ({
  // Auth
  auth: {
    user: null,
    token: null,
    isLoading: true,
  },
  setUser: (user) =>
    set((state) => ({ auth: { ...state.auth, user } })),
  setToken: (token) =>
    set((state) => ({ auth: { ...state.auth, token } })),
  setAuthLoading: (isLoading) =>
    set((state) => ({ auth: { ...state.auth, isLoading } })),
  logout: () =>
    set({
      auth: { user: null, token: null, isLoading: false },
      chatIntent: null,
    }),

  // Navigation
  navIndex: 0,
  setNavIndex: (index) => set({ navIndex: index }),

  // Chat intent
  chatIntent: null,
  setChatIntent: (intent) => set({ chatIntent: intent }),
}));
