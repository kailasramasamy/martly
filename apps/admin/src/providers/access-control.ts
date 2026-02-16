import type { AccessControlProvider } from "@refinedev/core";

export const accessControlProvider: AccessControlProvider = {
  can: async ({ resource, action }) => {
    // Read identity from the token (synchronous decode)
    const token = localStorage.getItem("martly_admin_token");
    if (!token) return { can: false };

    let role = "";
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      role = payload.role;
    } catch {
      return { can: false };
    }

    // SUPER_ADMIN can do everything
    if (role === "SUPER_ADMIN") return { can: true };

    // Organizations: SUPER_ADMIN only
    if (resource === "organizations") {
      return { can: false, reason: "Only Super Admin can manage organizations" };
    }

    // Users: SUPER_ADMIN and ORG_ADMIN can manage
    if (resource === "users") {
      if (role === "ORG_ADMIN") {
        return { can: true };
      }
      return { can: false, reason: "Only Super Admin or Org Admin can manage users" };
    }

    // Categories, brands: read OK, write SUPER_ADMIN only
    if (["categories", "brands"].includes(resource || "")) {
      if (action === "list" || action === "show") {
        return { can: true };
      }
      return { can: false, reason: "Only Super Admin can modify the global catalog" };
    }

    // Stock: read-only for all allowed roles
    if (resource === "stock") {
      if (action === "list" || action === "show") return { can: true };
      return { can: false };
    }

    // Products: read OK, write for SUPER_ADMIN and ORG_ADMIN (API enforces ownership)
    if (resource === "products") {
      if (action === "list" || action === "show") {
        return { can: true };
      }
      if (role === "ORG_ADMIN") {
        return { can: true };
      }
      return { can: false, reason: "Only Super Admin or Org Admin can modify products" };
    }

    // Everything else: allow
    return { can: true };
  },

  options: {
    buttons: { enableAccessControl: true, hideIfUnauthorized: true },
  },
};
