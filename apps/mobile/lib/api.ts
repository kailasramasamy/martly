import { fetch as streamingFetch } from "expo/fetch";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { API_URL } from "./config";
import { strings } from "./i18n";


let accessToken: string | null = null;
let tokenRefresher: (() => Promise<string | null>) | null = null;
let refreshPromise: Promise<string | null> | null = null;

// Credential endpoints: a 401 here means bad input, not an expired session
const NO_REFRESH_PATHS = ["/auth/send-otp", "/auth/verify-otp", "/auth/register", "/auth/refresh", "/auth/login", "/auth/select-org"];

export function setAccessToken(token: string | null) {
  accessToken = token;
}

/** Register a callback that refreshes the access token using the stored refresh token */
export function setTokenRefresher(fn: (() => Promise<string | null>) | null) {
  tokenRefresher = fn;
}

/** A failed request; `status` tells e.g. a plan limit (402) from other errors, `code` is the API's error name (e.g. AI_IMAGES_EXHAUSTED) */
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}

/** Refreshes the access token once for any number of concurrent 401s; resolves to the new token, or null */
function refreshAccessToken() {
  if (!refreshPromise && tokenRefresher) {
    refreshPromise = tokenRefresher().finally(() => { refreshPromise = null; });
  }
  return refreshPromise ?? Promise.resolve(null);
}

async function errorOf(response: { status: number; json: () => Promise<{ message?: string; error?: string }> }) {
  const error = await response.json().catch(() => ({ message: strings("auth").errors.requestFailed, error: undefined }));
  return new ApiError(error.message ?? `HTTP ${response.status}`, response.status, error.error);
}

async function request<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) ?? {}),
  };

  // FormData sets its own multipart boundary header
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  // On 401, try refreshing the token once (skip for credential endpoints, and for guests who never sent one)
  if (response.status === 401 && !isRetry && headers.Authorization && tokenRefresher && !NO_REFRESH_PATHS.some((p) => path.includes(p))) {
    if (await refreshAccessToken()) {
      return request<T>(path, options, true);
    }
  }

  if (!response.ok) throw await errorOf(response);

  return response.json() as Promise<T>;
}

/**
 * POSTs and reads a newline-delimited JSON response as it arrives, handing each object to `onEvent`
 * (so a screen can show results while the rest are still coming). Retries once on an expired session.
 */
async function stream<E>(path: string, body: unknown, onEvent: (event: E) => void, isRetry = false): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const response = await streamingFetch(`${API_URL}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  if (response.status === 401 && !isRetry && headers.Authorization && (await refreshAccessToken())) {
    return stream(path, body, onEvent, true);
  }
  if (!response.ok || !response.body) throw await errorOf(response);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffered += decoder.decode(value, { stream: true });
    let end: number;
    while ((end = buffered.indexOf("\n")) >= 0) {
      const line = buffered.slice(0, end).trim();
      buffered = buffered.slice(end + 1);
      if (line) onEvent(JSON.parse(line) as E);
    }
  }
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
  upload: <T>(path: string, form: FormData) =>
    request<ApiResponse<T>>(path, { method: "POST", body: form }),
  stream,
};
