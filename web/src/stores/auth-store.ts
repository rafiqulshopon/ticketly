import { create } from "zustand";
import type { User, UserRole } from "@ticketly/shared";

interface AuthState {
  user: User | null;
  setUser: (user: User | null) => void;
  hasRole: (role: UserRole) => boolean;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  setUser: (user) => set({ user }),
  hasRole: (role) => get().user?.role === role,
  clear: () => set({ user: null }),
}));
