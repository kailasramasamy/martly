import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAccessToken, setTokenRefresher, api, ApiError, withTimeout } from "./api";
import { registerForPushNotifications, unregisterPushToken } from "./notifications";
import type { AuthTokens, OrgSummary } from "@martly/shared/types";
import { API_URL } from "./config";
import { clearRecentlyViewed } from "./recently-viewed";

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  organizationId?: string;
  organizations: OrgSummary[];
  stores: { id: string; name: string }[];
  /** Effective permissions in the selected organization (role preset + owner-granted add-ons) */
  permissions: string[];
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserInfo | null;
  login: (tokens: AuthTokens) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  /** Counts sign-outs this session, including a saved session the server refuses at launch */
  signOuts: number;
}

const AuthContext = createContext<AuthState | null>(null);

const ACCESS_TOKEN_KEY = "martly_access_token";
const REFRESH_TOKEN_KEY = "martly_refresh_token";
/** The signed-in user as last fetched, so a launch without network still knows who (and which persona) it is */
const USER_KEY = "martly_user";

async function cachedUser(): Promise<UserInfo | null> {
  const saved = await AsyncStorage.getItem(USER_KEY).catch(() => null);
  return saved ? (JSON.parse(saved) as UserInfo) : null;
}

const rememberUser = (user: UserInfo) => AsyncStorage.setItem(USER_KEY, JSON.stringify(user)).catch(() => undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [signOuts, setSignOuts] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<UserInfo | null>(null);
  const pushTokenRef = useRef<string | null>(null);
  const logoutRef = useRef<() => Promise<void>>(undefined);
  const forcedLogoutRef = useRef<() => Promise<void>>(undefined);

  // Set when the server refuses the saved session, so a launch that failed to load the user knows not to keep it
  const sessionRefusedRef = useRef(false);

  // Register the token refresher so api.ts can transparently refresh on 401
  useEffect(() => {
    // Not awaited: signing out must not wait on requests that can themselves be waiting on this refresh
    const endSession = () => {
      sessionRefusedRef.current = true;
      forcedLogoutRef.current?.();
    };
    setTokenRefresher(async () => {
      try {
        const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
        if (!refreshToken) {
          endSession();
          return null;
        }
        const res = await withTimeout((signal) => fetch(`${API_URL}/api/v1/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
          signal,
        }));
        // Only the server refusing the refresh token ends the session; a 5xx leaves it for the next try
        if (res.status === 401 || res.status === 403) {
          endSession();
          return null;
        }
        if (!res.ok) return null;
        const json = await res.json();
        const newToken = json.data?.accessToken;
        if (newToken) {
          setAccessToken(newToken);
          await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, newToken);
          return newToken;
        }
        endSession();
        return null;
      } catch {
        // Offline, timed out or the request failed: stay signed in and refresh on a later request
        return null;
      }
    });
    return () => setTokenRefresher(null);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
        if (!token) return;
        setAccessToken(token);
        try {
          const res = await api.get<UserInfo>("/api/v1/auth/me");
          setUser(res.data);
          rememberUser(res.data);
        } catch (err) {
          // The account is gone or blocked: sign out. A refused refresh token already signed out in the refresher;
          // anything else (offline, server error) keeps the session with the user as last seen.
          if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
            await logoutRef.current?.();
            return;
          }
          if (sessionRefusedRef.current) return;
          setUser(await cachedUser());
        }
        setIsAuthenticated(true);
        // Register push token after session restore; no push permission or network leaves the session as it is
        pushTokenRef.current = await registerForPushNotifications().catch(() => null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (tokens: AuthTokens) => {
    setAccessToken(tokens.accessToken);
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);

    try {
      const res = await api.get<UserInfo>("/api/v1/auth/me");
      setUser(res.data);
      rememberUser(res.data);
    } catch {
      // token worked for login, user info fetch failed — proceed anyway
    }
    setIsAuthenticated(true);

    // Register push notifications after login
    const pt = await registerForPushNotifications();
    pushTokenRef.current = pt;
  }, []);

  const clearSession = useCallback(async () => {
    setAccessToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setSignOuts((n) => n + 1);
    clearRecentlyViewed();
    await AsyncStorage.removeItem(USER_KEY).catch(() => undefined);
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  }, []);

  const logout = useCallback(async () => {
    // Unregister while still signed in; it gives up after a few seconds so a bad network can't block signing out
    const pushToken = pushTokenRef.current;
    pushTokenRef.current = null;
    if (pushToken) await unregisterPushToken(pushToken);
    await clearSession();
  }, [clearSession]);

  // The server refused the session: sign out at once. No unregister: it could only authenticate by starting
  // another refresh with the refused token, racing the sign-out.
  const forcedLogout = useCallback(async () => {
    pushTokenRef.current = null;
    await clearSession();
  }, [clearSession]);

  // Keep logoutRef in sync so the refresher can trigger logout
  logoutRef.current = logout;
  forcedLogoutRef.current = forcedLogout;

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get<UserInfo>("/api/v1/auth/me");
      setUser(res.data);
      rememberUser(res.data);
    } catch {
      // silently fail
    }
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, login, logout, refreshUser, signOuts }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
