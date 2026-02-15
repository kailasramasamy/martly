import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { setAccessToken } from "./api";
import type { AuthTokens } from "@martly/shared/types";

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (tokens: AuthTokens) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading] = useState(false);

  const login = useCallback((tokens: AuthTokens) => {
    setAccessToken(tokens.accessToken);
    setIsAuthenticated(true);
    // TODO: persist tokens with expo-secure-store
  }, []);

  const logout = useCallback(() => {
    setAccessToken(null);
    setIsAuthenticated(false);
    // TODO: clear persisted tokens
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
