"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AUTH_PERSIST_STORAGE_KEY, setAuthToken } from "./api";

export type AuthSession =
  | { role: "SUPER_ADMIN" }
  | {
      role: "BUSINESS";
      /** Public code e.g. S7-0001 */
      businessId: string;
      businessName: string;
      /** Internal UUID */
      id: string;
      /** From GET/PATCH /auth/me — thermal receipt width (mm). */
      receiptPaperWidthMm?: number;
      /** From GET/PATCH /auth/me — open print dialog after new sale. */
      printReceiptAfterSale?: boolean;
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
      name: AUTH_PERSIST_STORAGE_KEY,
      partialize: (s) => ({ token: s.token, session: s.session }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) setAuthToken(state.token);
      },
    },
  ),
);
