import type { AccessControlProvider } from "@refinedev/core";
import { can, isResource, type ResourceAction } from "@martly/shared/permissions";

export const accessControlProvider: AccessControlProvider = {
  can: async ({ resource, action }) => {
    // Read identity from the token (synchronous decode)
    const token = localStorage.getItem("martly_admin_token");
    if (!token) return { can: false };

    let payload: { role: string; permissions?: string[] };
    try {
      payload = JSON.parse(atob(token.split(".")[1]));
    } catch {
      return { can: false };
    }

    if (!resource || !isResource(resource)) return { can: payload.role === "SUPER_ADMIN" };
    if (can(payload, resource, action as ResourceAction)) return { can: true };
    return { can: false, reason: "You don't have access to this section" };
  },

  options: {
    buttons: { enableAccessControl: true, hideIfUnauthorized: true },
  },
};
