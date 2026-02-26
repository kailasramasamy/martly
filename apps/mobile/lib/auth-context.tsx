import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { setAccessToken, setTokenRefresher, api } from "./api";
import { registerForPushNotifications, unregisterPushToken } from "./notifications";
import type { AuthTokens } from "@martly/shared/types";

interface UserInfo {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserInfo | null;
  login: (tokens: AuthTokens) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const ACCESS_TOKEN_KEY = "martly_access_token";
const REFRESH_TOKEN_KEY = "martly_refresh_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<UserInfo | null>(null);
  const pushTokenRef = useRef<string | null>(null);
  const logoutRef = useRef<() => Promise<void>>();

  // Register the token refresher so api.ts can transparently refresh on 401
  useEffect(() => {
    setTokenRefresher(async () => {
      try {
        const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
        if (!refreshToken) {
          logoutRef.current?.();
          return null;
        }
        const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:7001";
        const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) {
          logoutRef.current?.();
          return null;
        }
        const json = await res.json();
        const newToken = json.data?.accessToken;
        if (newToken) {
          setAccessToken(newToken);
          await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, newToken);
          return newToken;
        }
        logoutRef.current?.();
        return null;
      } catch {
        logoutRef.current?.();
        return null;
      }
    });
    return () => setTokenRefresher(null);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
        if (token) {
          setAccessToken(token);
          const res = await api.get<UserInfo>("/api/v1/auth/me");
          setUser(res.data);
          setIsAuthenticated(true);
          // Register push token after session restore
          const pt = await registerForPushNotifications();
          pushTokenRef.current = pt;
        }
      } catch {
        await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
        setAccessToken(null);
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
    } catch {
      // token worked for login, user info fetch failed — proceed anyway
    }
    setIsAuthenticated(true);

    // Register push notifications after login
    const pt = await registerForPushNotifications();
    pushTokenRef.current = pt;
  }, []);

  const logout = useCallback(async () => {
    // Unregister push token before clearing auth
    if (pushTokenRef.current) {
      await unregisterPushToken(pushTokenRef.current);
      pushTokenRef.current = null;
    }

    setAccessToken(null);
    setUser(null);
    setIsAuthenticated(false);
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  }, []);

  // Keep logoutRef in sync so the refresher can trigger logout
  logoutRef.current = logout;

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get<UserInfo>("/api/v1/auth/me");
      setUser(res.data);
    } catch {
      // silently fail
    }
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
