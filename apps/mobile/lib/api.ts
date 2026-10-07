import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { API_URL } from "./config";


let accessToken: string | null = null;
let tokenRefresher: (() => Promise<string | null>) | null = null;
let refreshPromise: Promise<string | null> | null = null;

// Credential endpoints: a 401 here means bad input, not an expired session
const NO_REFRESH_PATHS = ["/auth/send-otp", "/auth/verify-otp", "/auth/register", "/auth/refresh"];

export function setAccessToken(token: string | null) {
  accessToken = token;
}

/** Register a callback that refreshes the access token using the stored refresh token */
export function setTokenRefresher(fn: (() => Promise<string | null>) | null) {
  tokenRefresher = fn;
}

async function request<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) ?? {}),
  };

  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  // On 401, try refreshing the token once (skip for credential endpoints)
  if (response.status === 401 && !isRetry && tokenRefresher && !NO_REFRESH_PATHS.some((p) => path.includes(p))) {
    // Deduplicate concurrent refresh calls
    if (!refreshPromise) {
      refreshPromise = tokenRefresher().finally(() => { refreshPromise = null; });
    }
    const newToken = await refreshPromise;
    if (newToken) {
      return request<T>(path, options, true);
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message ?? `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getApiUrl() { return API_URL; }
export function getAccessToken() { return accessToken; }

export const api = {
  get: <T>(path: string) => request<ApiResponse<T>>(path),
  getList: <T>(path: string) => request<PaginatedResponse<T>>(path),
  post: <T>(path: string, body: unknown) =>
    request<ApiResponse<T>>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<ApiResponse<T>>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<ApiResponse<T>>(path, { method: "PATCH", ...(body ? { body: JSON.stringify(body) } : {}) }),
  delete: <T>(path: string, body?: unknown) =>
    request<ApiResponse<T>>(path, { method: "DELETE", ...(body ? { body: JSON.stringify(body) } : {}) }),
};
