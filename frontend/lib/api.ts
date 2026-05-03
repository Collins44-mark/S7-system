import axios from "axios";

/** Zustand persist key — import in `auth-store.ts` as `persist.name`. */
export const AUTH_PERSIST_STORAGE_KEY = "hardware-auth-v2";

function readPersistedBearerToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_PERSIST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { token?: string | null } };
    const t = parsed?.state?.token;
    return typeof t === "string" && t.length > 0 ? t : null;
  } catch {
    return null;
  }
}

/**
 * NEXT_PUBLIC_API_URL = API origin without path, e.g. https://api.example.com or http://localhost:5000
 * The `/api` prefix is appended automatically (Nest global prefix).
 */
export function getResolvedApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (raw) {
    const root = raw.replace(/\/$/, "");
    return root.endsWith("/api") ? root : `${root}/api`;
  }
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:5000/api";
  }
  return "";
}

const baseURL = getResolvedApiBaseUrl();

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

/**
 * Zustand persist rehydrates after the first paint; axios defaults may still lack
 * Authorization. Attach Bearer from the same localStorage key on every request.
 */
api.interceptors.request.use((config) => {
  if (typeof window === "undefined") return config;
  const t = readPersistedBearerToken();
  if (t) {
    config.headers.Authorization = `Bearer ${t}`;
  } else {
    delete config.headers.Authorization;
  }
  return config;
});

const initialToken = readPersistedBearerToken();
if (initialToken) {
  api.defaults.headers.common.Authorization = `Bearer ${initialToken}`;
}

/** True when production build has no API URL (requests will fail). */
export function isApiUrlMissing(): boolean {
  return (
    process.env.NODE_ENV === "production" &&
    !process.env.NEXT_PUBLIC_API_URL?.trim()
  );
}

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}
