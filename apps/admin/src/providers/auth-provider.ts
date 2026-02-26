import type { AuthProvider } from "@refinedev/core";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:7001";
const TOKEN_KEY = "martly_admin_token";
const REFRESH_TOKEN_KEY = "martly_admin_refresh_token";
const PENDING_ORGS_KEY = "martly_pending_orgs";
const TEMP_TOKEN_KEY = "martly_temp_token";

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
}

/**
 * Attempt to refresh the access token using the stored refresh token.
 * Returns the new access token on success, or null on failure.
 */
let refreshPromise: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  // Deduplicate concurrent refresh calls
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return null;

    try {
      const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) return null;

      const { data } = await response.json();
      localStorage.setItem(TOKEN_KEY, data.accessToken);
      return data.accessToken as string;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/** Get pending orgs list (set during multi-org login) */
export function getPendingOrgs(): OrgSummary[] {
  try {
    const raw = localStorage.getItem(PENDING_ORGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Call /auth/select-org, store new tokens, clear pending state */
export async function selectOrganization(orgId: string): Promise<void> {
  // Use temp token if available, otherwise use regular token
  const token = localStorage.getItem(TEMP_TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  if (!token) throw new Error("No token available");

  const response = await fetch(`${API_URL}/api/v1/auth/select-org`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ organizationId: orgId }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || "Failed to select organization");
  }

  const { data } = await response.json();
  localStorage.setItem(TOKEN_KEY, data.accessToken);
  if (data.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
  }
  // Clean up temp state
  localStorage.removeItem(PENDING_ORGS_KEY);
  localStorage.removeItem(TEMP_TOKEN_KEY);
}

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

    if (data.requiresOrgSelection) {
      // Store temp token + orgs for the select-org page
      localStorage.setItem(TEMP_TOKEN_KEY, data.temporaryToken);
      localStorage.setItem(PENDING_ORGS_KEY, JSON.stringify(data.organizations));
      return { success: true, redirectTo: "/select-org" };
    }

    // Normal login (single org or SUPER_ADMIN/CUSTOMER)
    localStorage.setItem(TOKEN_KEY, data.accessToken);
    if (data.refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    }
    return { success: true, redirectTo: "/" };
  },

  logout: async () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(PENDING_ORGS_KEY);
    localStorage.removeItem(TEMP_TOKEN_KEY);
    return { success: true, redirectTo: "/login" };
  },

  check: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    const tempToken = localStorage.getItem(TEMP_TOKEN_KEY);
    if (!token && !tempToken) {
      return { authenticated: false, redirectTo: "/login" };
    }

    // Validate the access token is still usable
    if (token) {
      try {
        const response = await fetch(`${API_URL}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          return { authenticated: true };
        }
        // Token expired — try refresh
        const newToken = await refreshAccessToken();
        if (newToken) {
          return { authenticated: true };
        }
        // Refresh also failed — force logout
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        return { authenticated: false, redirectTo: "/login" };
      } catch {
        return { authenticated: true }; // Network error — don't logout, let data calls handle it
      }
    }

    return { authenticated: true };
  },

  getIdentity: async () => {
    let token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;

    try {
      let response = await fetch(`${API_URL}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // If 401, try refreshing the token
      if (response.status === 401) {
        const newToken = await refreshAccessToken();
        if (!newToken) return null;
        token = newToken;
        response = await fetch(`${API_URL}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      if (!response.ok) return null;

      const { data } = await response.json();
      return {
        id: data.id,
        name: data.name || data.email,
        email: data.email,
        role: data.role,
        organizationId: data.organizationId,
        organizations: data.organizations || [],
        stores: data.stores || [],
      };
    } catch {
      return null;
    }
  },

  onError: async (error) => {
    // 401s from data provider are already handled by the axios interceptor.
    // If we still get here with 401, refresh has already failed — force logout.
    if (error.status === 401 || error.response?.status === 401) {
      return { logout: true };
    }
    return { error };
  },
};
