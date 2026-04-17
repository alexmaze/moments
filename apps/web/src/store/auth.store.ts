import { create } from "zustand";
import { persist } from "zustand/middleware";
import i18n from "@/i18n";
import { useLocaleStore } from "./locale.store";
import { useThemeStore } from "./theme.store";
import type { UserDto } from "@/types/dto";

interface AuthState {
  token: string | null;
  currentUser: UserDto | null;
  setAuth: (token: string, user: UserDto) => void;
  setCurrentUser: (user: UserDto) => void;
  clearAuth: () => void;
}

function syncLocaleFromUser(user: UserDto) {
  // null = user hasn't set a preference, keep using browser language
  useLocaleStore.getState().setLocale(user.locale);
  if (user.locale) {
    if (i18n.language !== user.locale) {
      i18n.changeLanguage(user.locale);
    }
  }
}

function syncThemeFromUser(user: UserDto) {
  // null = user hasn't set a preference, keep using system theme
  useThemeStore.getState().setTheme(user.theme);
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      currentUser: null,
      setAuth: (token, user) => {
        set({ token, currentUser: user });
        syncLocaleFromUser(user);
        syncThemeFromUser(user);
      },
      setCurrentUser: (user) => {
        set({ currentUser: user });
        syncLocaleFromUser(user);
        syncThemeFromUser(user);
      },
      clearAuth: () => set({ token: null, currentUser: null }),
    }),
    { name: "moments-auth" },
  ),
);
