import type { AuthProvider } from "@refinedev/core";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
const TOKEN_KEY = "martly_admin_token";

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    const response = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      return { success: false, error: { name: "LoginError", message: "Invalid credentials" } };
    }

    const { data } = await response.json();
    localStorage.setItem(TOKEN_KEY, data.accessToken);

    return { success: true, redirectTo: "/" };
  },

  logout: async () => {
    localStorage.removeItem(TOKEN_KEY);
    return { success: true, redirectTo: "/login" };
  },

  check: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      return { authenticated: true };
    }
    return { authenticated: false, redirectTo: "/login" };
  },

  getIdentity: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;

    // Decode JWT payload (no verification — server verifies on API calls)
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return { id: payload.sub, name: payload.email, email: payload.email };
    } catch {
      return null;
    }
  },

  onError: async (error) => {
    if (error.status === 401) {
      return { logout: true };
    }
    return { error };
  },
};
