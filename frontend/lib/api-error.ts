import { isAxiosError } from "axios";
import { getResolvedApiBaseUrl } from "./api";

/**
 * Human-readable message from API or network errors.
 */
export function getApiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string | string[] }
      | undefined;
    if (data?.message != null) {
      const m = data.message;
      return Array.isArray(m) ? m.join(", ") : String(m);
    }
    if (error.code === "ECONNABORTED") {
      return "Request timed out. Try again.";
    }
    if (!error.response) {
      const base = getResolvedApiBaseUrl();
      const parts = [
        "Cannot reach the API server (network error). Common causes:",
      ];
      if (!base) {
        parts.push(
          "• Frontend env NEXT_PUBLIC_API_URL is not set. On Vercel: Project → Settings → Environment Variables → add NEXT_PUBLIC_API_URL = your backend URL (https://… without /api), then redeploy.",
        );
      } else {
        parts.push(`• Browser tried: ${base}`);
        parts.push(
          "• Wrong URL, API offline, or firewall.",
          "• HTTPS page calling HTTP API is blocked — use https:// on your API URL.",
          "• CORS: set backend CORS_ORIGIN to your frontend origin (e.g. https://your-app.vercel.app).",
        );
      }
      return parts.join("\n");
    }
    return error.response.statusText || `Error ${error.response.status}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong.";
}
