import { isAxiosError } from "axios";

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
      return "Cannot reach the server. Check your connection and API URL.";
    }
    return error.response.statusText || `Error ${error.response.status}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong.";
}
