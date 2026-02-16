import type { AuthProvider } from "@refinedev/core";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:7001";
const TOKEN_KEY = "martly_admin_token";
const PENDING_ORGS_KEY = "martly_pending_orgs";
const TEMP_TOKEN_KEY = "martly_temp_token";

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
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
    return { success: true, redirectTo: "/" };
  },

  logout: async () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PENDING_ORGS_KEY);
    localStorage.removeItem(TEMP_TOKEN_KEY);
    return { success: true, redirectTo: "/login" };
  },

  check: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    const tempToken = localStorage.getItem(TEMP_TOKEN_KEY);
    if (token || tempToken) {
      return { authenticated: true };
    }
    return { authenticated: false, redirectTo: "/login" };
  },

  getIdentity: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;

    try {
      const response = await fetch(`${API_URL}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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
    if (error.status === 401) {
      return { logout: true };
    }
    return { error };
  },
};
