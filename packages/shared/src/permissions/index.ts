export type ResourceAction = "list" | "show" | "create" | "edit" | "delete";
type Role = "SUPER_ADMIN" | "ORG_ADMIN" | "STORE_MANAGER" | "STAFF" | "RIDER" | "CUSTOMER";
type Grant = Partial<Record<Role, readonly ResourceAction[]>>;

const READ = ["list", "show"] as const;
const ALL = ["list", "show", "create", "edit", "delete"] as const;
const STAFF_ROLES = ["ORG_ADMIN", "STORE_MANAGER", "STAFF", "RIDER"] as const;

const orgAdmin: Grant = { ORG_ADMIN: ALL };
const everyStaff = (actions: readonly ResourceAction[]): Grant =>
  Object.fromEntries(STAFF_ROLES.map((role) => [role, actions]));
const orgAdminWriteOthersRead: Grant = { ...everyStaff(READ), ORG_ADMIN: ALL };
const orgAdminWriteManagerRead: Grant = { ORG_ADMIN: ALL, STORE_MANAGER: READ };
const managers: Grant = { ORG_ADMIN: ALL, STORE_MANAGER: ALL };

/** Role → allowed actions per resource. SUPER_ADMIN is implicitly granted everything. */
export const RESOURCE_PERMISSIONS = {
  // Menu groups (containers only)
  inventory: everyStaff(READ),
  marketing: everyStaff(READ),
  delivery: everyStaff(READ),
  operations: { ORG_ADMIN: READ, STORE_MANAGER: READ },
  notifications: { ORG_ADMIN: READ },

  // Daily operations
  dashboard: everyStaff(READ),
  orders: everyStaff(["list", "show", "edit"]),
  stock: everyStaff(READ),
  "store-products": { ORG_ADMIN: ALL, STORE_MANAGER: ALL, STAFF: ["list", "show", "edit"] },
  "delivery-board": everyStaff(ALL),
  riders: managers,
  "return-requests": orgAdminWriteManagerRead,
  "support-tickets": orgAdminWriteManagerRead,
  "store-intelligence": { ORG_ADMIN: READ, STORE_MANAGER: READ },
  "customer-insights": { ORG_ADMIN: READ, STORE_MANAGER: READ },

  // Organization
  organizations: {},
  users: orgAdmin,
  customers: { ORG_ADMIN: ["list", "show", "delete"] },
  stores: { ORG_ADMIN: ALL, STORE_MANAGER: ["list", "show", "edit"], STAFF: READ, RIDER: READ },

  // Catalog
  categories: everyStaff(READ),
  brands: everyStaff(READ),
  products: orgAdminWriteOthersRead,
  "featured-products": managers,
  "catalog-drafts": managers,
  collections: orgAdminWriteOthersRead,
  recipes: orgAdminWriteOthersRead,

  // Marketing
  banners: orgAdmin,
  promos: orgAdmin,
  "festival-events": { ORG_ADMIN: ["list"] },
  coupons: orgAdmin,
  reviews: orgAdmin,
  "review-analytics": orgAdmin,
  "store-ratings": orgAdmin,
  "notification-dashboard": orgAdmin,
  "notification-campaigns": orgAdmin,
  "notification-send": orgAdmin,
  "notification-templates": orgAdmin,
  "loyalty-settings": orgAdmin,
  "loyalty-customers": orgAdmin,
  "referral-settings": orgAdmin,
  "referral-list": orgAdmin,
  "membership-plans": orgAdmin,
  "membership-subscribers": orgAdmin,
  "subscription-config": orgAdmin,
  subscriptions: orgAdmin,

  // Delivery configuration
  "delivery-zones": orgAdmin,
  "delivery-tiers": orgAdmin,
  "delivery-slots": orgAdmin,
  "express-delivery": orgAdmin,
} satisfies Record<string, Grant>;

export type Resource = keyof typeof RESOURCE_PERMISSIONS;

export function can(role: string, resource: Resource, action: ResourceAction = "list"): boolean {
  if (role === "SUPER_ADMIN") return true;
  const grant: Grant = RESOURCE_PERMISSIONS[resource];
  return grant[role as Role]?.includes(action) ?? false;
}

export function isResource(name: string): name is Resource {
  return name in RESOURCE_PERMISSIONS;
}

/** Roles that get the Manage persona in the mobile app */
export const MANAGE_ROLES = ["SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER"] as const;

export function canManage(role: string | undefined): boolean {
  return !!role && (MANAGE_ROLES as readonly string[]).includes(role);
}
