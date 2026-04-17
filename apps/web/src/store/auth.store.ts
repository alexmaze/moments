import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserDto } from "@/types/dto";

interface AuthState {
  token: string | null;
  currentUser: UserDto | null;
  setAuth: (token: string, user: UserDto) => void;
  setCurrentUser: (user: UserDto) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      currentUser: null,
      setAuth: (token, user) => set({ token, currentUser: user }),
      setCurrentUser: (user) => set({ currentUser: user }),
      clearAuth: () => set({ token: null, currentUser: null }),
    }),
    { name: "moments-auth" },
  ),
);
