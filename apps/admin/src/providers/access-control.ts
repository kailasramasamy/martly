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

    // Customers: SUPER_ADMIN and ORG_ADMIN can view + delete
    if (resource === "customers") {
      if (role === "ORG_ADMIN") {
        if (action === "list" || action === "show" || action === "delete") return { can: true };
        return { can: false };
      }
      return { can: false, reason: "Only Super Admin or Org Admin can view customers" };
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

    // Banners: ORG_ADMIN full access
    if (resource === "banners") {
      if (role === "ORG_ADMIN") return { can: true };
      return { can: false, reason: "Only Super Admin or Org Admin can manage banners" };
    }

    // Collections: ORG_ADMIN full access, others read-only
    if (resource === "collections") {
      if (role === "ORG_ADMIN") return { can: true };
      if (action === "list" || action === "show") return { can: true };
      return { can: false };
    }

    // Coupons: ORG_ADMIN full access
    if (resource === "coupons") {
      if (role === "ORG_ADMIN") return { can: true };
      return { can: false, reason: "Only Super Admin or Org Admin can manage coupons" };
    }

    // Reviews: ORG_ADMIN full access
    if (resource === "reviews") {
      if (role === "ORG_ADMIN") return { can: true };
      return { can: false, reason: "Only Super Admin or Org Admin can moderate reviews" };
    }

    // Delivery Zones: ORG_ADMIN full access
    if (resource === "delivery-zones") {
      if (role === "ORG_ADMIN") return { can: true };
      return { can: false, reason: "Only Super Admin or Org Admin can manage delivery zones" };
    }

    // Delivery Tiers: ORG_ADMIN full access
    if (resource === "delivery-tiers") {
      if (role === "ORG_ADMIN") return { can: true };
      return { can: false, reason: "Only Super Admin or Org Admin can manage delivery tiers" };
    }

    // Express Delivery Config: ORG_ADMIN full access
    if (resource === "express-delivery") {
      if (role === "ORG_ADMIN") return { can: true };
      return { can: false, reason: "Only Super Admin or Org Admin can manage express delivery config" };
    }

    // Riders: ORG_ADMIN, STORE_MANAGER
    if (resource === "riders") {
      if (["SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER"].includes(role)) return { can: true };
      return { can: false, reason: "Access denied" };
    }

    // Delivery Board: ORG_ADMIN, STORE_MANAGER, STAFF
    if (resource === "delivery-board") {
      if (["ORG_ADMIN", "STORE_MANAGER", "STAFF"].includes(role)) return { can: true };
      return { can: false, reason: "Access denied" };
    }

    // Delivery Slots: ORG_ADMIN full access
    if (resource === "delivery-slots") {
      if (role === "ORG_ADMIN") return { can: true };
      return { can: false, reason: "Only Super Admin or Org Admin can manage delivery time slots" };
    }

    // Notifications: ORG_ADMIN full access
    if (resource === "notifications") {
      if (role === "ORG_ADMIN") return { can: true };
      return { can: false, reason: "Only Super Admin or Org Admin can send notifications" };
    }

    // Loyalty: ORG_ADMIN full access
    if (resource === "loyalty-settings" || resource === "loyalty-customers") {
      if (role === "ORG_ADMIN") return { can: true };
      return { can: false, reason: "Only Super Admin or Org Admin can manage loyalty" };
    }

    // Everything else: allow
    return { can: true };
  },

  options: {
    buttons: { enableAccessControl: true, hideIfUnauthorized: true },
  },
};
