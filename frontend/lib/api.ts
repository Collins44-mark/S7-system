import axios from "axios";

/**
 * NEXT_PUBLIC_API_URL = API origin without path, e.g. https://api.example.com or http://localhost:5000
 * The `/api` prefix is appended automatically (Nest global prefix).
 */
function resolveApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (raw) {
    const root = raw.replace(/\/$/, "");
    return root.endsWith("/api") ? root : `${root}/api`;
  }
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:5000/api";
  }
  console.warn(
    "[api] NEXT_PUBLIC_API_URL is unset in production; configure it in your deployment environment.",
  );
  return "";
}

const baseURL = resolveApiBaseUrl();

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}
