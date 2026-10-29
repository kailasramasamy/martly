import { fetch as streamingFetch } from "expo/fetch";
import type { ApiResponse, PaginatedResponse } from "@martly/shared/types";
import { API_URL } from "./config";
import { strings } from "./i18n";


let accessToken: string | null = null;
let tokenRefresher: (() => Promise<string | null>) | null = null;
let refreshPromise: Promise<string | null> | null = null;

// Credential endpoints: a 401 here means bad input, not an expired session
const NO_REFRESH_PATHS = ["/auth/send-otp", "/auth/verify-otp", "/auth/register", "/auth/refresh", "/auth/login", "/auth/select-org"];

const DEFAULT_TIMEOUT_MS = 20_000;
/** Uploads and streamed answers move far more data than a plain request */
const LONG_TIMEOUT_MS = 120_000;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

/** Register a callback that refreshes the access token using the stored refresh token */
export function setTokenRefresher(fn: (() => Promise<string | null>) | null) {
  tokenRefresher = fn;
}

/**
 * A failed request; `status` tells e.g. a plan limit (402) from other errors, `code` is the API's error name
 * (e.g. AI_IMAGES_EXHAUSTED). A request that timed out has status 0 and code TIMEOUT.
 */
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

/** A fresh access token for a connection that can't refresh on a 401 itself (a socket): refreshes when it has expired */
export async function freshAccessToken(): Promise<string | null> {
  if (!accessToken) return null;
  const payload = accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  const { exp } = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, "="))) as { exp?: number };
  const expiresInMs = (exp ?? 0) * 1000 - Date.now();
  return expiresInMs > 30_000 ? accessToken : refreshAccessToken();
}

/** Runs `run` with a signal that aborts after `timeoutMs`; a timed-out run throws an ApiError with code TIMEOUT */
export async function withTimeout<R>(run: (signal: AbortSignal) => Promise<R>, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<R> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } catch (err) {
    if (controller.signal.aborted) throw new ApiError(strings("auth").errors.timedOut, 0, "TIMEOUT");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function errorOf(response: { status: number; json: () => Promise<{ message?: string; error?: string }> }) {
  const error = await response.json().catch(() => ({ message: strings("auth").errors.requestFailed, error: undefined }));
  return new ApiError(error.message ?? `HTTP ${response.status}`, response.status, error.error);
}

type RequestOptions = RequestInit & { timeoutMs?: number };

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { timeoutMs, ...init } = options;
  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string>) ?? {}),
  };

  // FormData sets its own multipart boundary header
  if (init.body && !(init.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  // On 401, try refreshing the token once (skip for credential endpoints, and for guests who never sent one)
  const canRefresh = !isRetry && !!headers.Authorization && !!tokenRefresher && !NO_REFRESH_PATHS.some((p) => path.includes(p));

  // The refresh waits outside the timer, so a slow refresh can't abort the retried request
  const outcome = await withTimeout(async (signal) => {
    const response = await fetch(`${API_URL}${path}`, { ...init, headers, signal });
    if (response.status === 401 && canRefresh) return { ok: false as const, expired: await errorOf(response) };
    if (!response.ok) throw await errorOf(response);
    return { ok: true as const, data: (await response.json()) as T };
  }, timeoutMs);

  if (outcome.ok) return outcome.data;
  if (await refreshAccessToken()) return request<T>(path, options, true);
  throw outcome.expired;
}

async function readLines<E>(reader: ReadableStreamDefaultReader<Uint8Array>, onEvent: (event: E) => void) {
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

/**
 * POSTs and reads a newline-delimited JSON response as it arrives, handing each object to `onEvent`
 * (so a screen can show results while the rest are still coming). Retries once on an expired session.
 */
async function stream<E>(path: string, body: unknown, onEvent: (event: E) => void, isRetry = false): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const expired = await withTimeout(async (signal) => {
    const response = await streamingFetch(`${API_URL}${path}`, { method: "POST", headers, body: JSON.stringify(body), signal });
    if (response.status === 401 && !isRetry && headers.Authorization) return errorOf(response);
    if (!response.ok || !response.body) throw await errorOf(response);
    await readLines(response.body.getReader(), onEvent);
    return null;
  }, LONG_TIMEOUT_MS);
  if (!expired) return;
  if (await refreshAccessToken()) return stream(path, body, onEvent, true);
  throw expired;
}

export function getApiUrl() { return API_URL; }
export function getAccessToken() { return accessToken; }

export const api = {
  get: <T>(path: string) => request<ApiResponse<T>>(path),
  getList: <T>(path: string) => request<PaginatedResponse<T>>(path),
  post: <T>(path: string, body: unknown, headers?: Record<string, string>) =>
    request<ApiResponse<T>>(path, { method: "POST", body: JSON.stringify(body), headers }),
  put: <T>(path: string, body: unknown) =>
    request<ApiResponse<T>>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<ApiResponse<T>>(path, { method: "PATCH", ...(body ? { body: JSON.stringify(body) } : {}) }),
  delete: <T>(path: string, body?: unknown, timeoutMs?: number) =>
    request<ApiResponse<T>>(path, { method: "DELETE", ...(body ? { body: JSON.stringify(body) } : {}), timeoutMs }),
  upload: <T>(path: string, form: FormData) =>
    request<ApiResponse<T>>(path, { method: "POST", body: form, timeoutMs: LONG_TIMEOUT_MS }),
  stream,
};
