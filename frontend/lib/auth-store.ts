"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { setAuthToken } from "./api";

export type AuthSession =
  | { role: "SUPER_ADMIN" }
  | {
      role: "BUSINESS";
      /** Public code e.g. S7-0001 */
      businessId: string;
      businessName: string;
      /** Internal UUID */
      id: string;
    };

type AuthState = {
  token: string | null;
  session: AuthSession | null;
  setSession: (token: string, session: AuthSession) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      session: null,
      setSession: (token, session) => {
        setAuthToken(token);
        set({ token, session });
      },
      clear: () => {
        setAuthToken(null);
        set({ token: null, session: null });
      },
    }),
    {
      name: "hardware-auth-v2",
      partialize: (s) => ({ token: s.token, session: s.session }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) setAuthToken(state.token);
      },
    },
  ),
);
