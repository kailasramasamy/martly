import { Permission } from "../constants/index";

const P = Permission;
const ALL_PERMISSIONS = Object.values(Permission) as Permission[];

/** Every role that works inside an organization (everyone except shoppers) */
export const STAFF_ROLES = ["SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER", "STAFF", "RIDER"] as const;

/** What each role can do out of the box */
export const ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  ORG_ADMIN: ALL_PERMISSIONS,
  STORE_MANAGER: [
    P.ORDERS_VIEW, P.ORDERS_PROCESS, P.ORDERS_DISPATCH, P.ORDERS_CANCEL, P.RIDERS_MANAGE,
    P.LISTING_AVAILABILITY, P.LISTING_MANAGE, P.LISTING_PRICES,
    P.STOCK_VIEW, P.STOCK_RECEIVE, P.STOCK_COUNT, P.STOCK_ADJUST, P.STOCK_APPROVE,
    P.CATALOG_PRODUCTS, P.REPORTS_VIEW, P.STORE_SETTINGS, P.FINANCE_MANAGE,
  ],
  STAFF: [P.LISTING_AVAILABILITY, P.STOCK_VIEW],
  // Riders see their own trips; the store's full order list is an add-on
  RIDER: [P.DELIVERY_DELIVER],
};

/** Extra responsibilities an owner may grant on top of each role's preset */
export const ROLE_ADDONS: Record<string, readonly Permission[]> = {
  STORE_MANAGER: [
    P.CATALOG_BRANDS, P.CATALOG_COLLECTIONS, P.MARKETING_MANAGE, P.DELIVERY_CONFIG,
    P.RETURNS_HANDLE, P.SUPPORT_HANDLE, P.REFUNDS_ISSUE,
  ],
  STAFF: [
    P.ORDERS_VIEW, P.ORDERS_PROCESS, P.ORDERS_DISPATCH, P.ORDERS_CANCEL, P.DELIVERY_DELIVER,
    P.CATALOG_PRODUCTS, P.CATALOG_BRANDS, P.CATALOG_COLLECTIONS,
    P.LISTING_PRICES, P.LISTING_MANAGE,
    P.STOCK_RECEIVE, P.STOCK_COUNT, P.STOCK_ADJUST,
    P.RETURNS_HANDLE, P.SUPPORT_HANDLE, P.REPORTS_VIEW,
  ],
  RIDER: [P.ORDERS_VIEW, P.ORDERS_PROCESS, P.ORDERS_DISPATCH, P.STOCK_COUNT],
};

export const PERMISSION_GROUPS = ["Orders", "Delivery", "Catalog", "Store listing", "Stock", "Customers", "Business"] as const;
export type PermissionGroup = (typeof PERMISSION_GROUPS)[number];

export const PERMISSION_META: Record<Permission, { label: string; description: string; group: PermissionGroup }> = {
  ORDERS_VIEW: { group: "Orders", label: "View orders", description: "See the store's online orders and customer details" },
  ORDERS_PROCESS: { group: "Orders", label: "Process orders", description: "Confirm, pack and mark orders ready; get new-order alerts" },
  ORDERS_DISPATCH: { group: "Orders", label: "Dispatch orders", description: "Assign riders, create trips, hand over pickups" },
  ORDERS_CANCEL: { group: "Orders", label: "Cancel orders", description: "Cancel a confirmed order (a reason is required)" },
  DELIVERY_DELIVER: { group: "Delivery", label: "Deliver orders", description: "Run their own delivery trips and collect cash" },
  RIDERS_MANAGE: { group: "Delivery", label: "Manage riders", description: "Add, edit and remove the store's riders" },
  CATALOG_PRODUCTS: { group: "Catalog", label: "Add & edit products", description: "Create and edit the organization's own products" },
  CATALOG_BRANDS: { group: "Catalog", label: "Local brands", description: "Create and edit the organization's own brands" },
  CATALOG_COLLECTIONS: { group: "Catalog", label: "Collections & recipes", description: "Curate collections and shoppable recipes" },
  LISTING_AVAILABILITY: { group: "Store listing", label: "Toggle availability", description: "Switch products on or off in the store" },
  LISTING_MANAGE: { group: "Store listing", label: "Manage listings", description: "Add or remove products from the store, set featured" },
  LISTING_PRICES: { group: "Store listing", label: "Change prices", description: "Set selling prices and discounts" },
  STOCK_VIEW: { group: "Stock", label: "View stock", description: "See stock levels" },
  STOCK_RECEIVE: { group: "Stock", label: "Receive stock", description: "Record deliveries from suppliers" },
  STOCK_COUNT: { group: "Stock", label: "Stock count", description: "Count shelf stock for audits" },
  STOCK_ADJUST: { group: "Stock", label: "Adjust stock", description: "Write off damage or expiry and correct stock" },
  STOCK_APPROVE: { group: "Stock", label: "Approve counts", description: "Review and apply stock count differences" },
  RETURNS_HANDLE: { group: "Customers", label: "Handle returns", description: "Approve or reject return requests" },
  SUPPORT_HANDLE: { group: "Customers", label: "Support tickets", description: "Reply to and resolve support tickets" },
  REFUNDS_ISSUE: { group: "Customers", label: "Issue refunds", description: "Credit or debit customer wallets" },
  MARKETING_MANAGE: { group: "Business", label: "Marketing", description: "Banners, offers, coupons, loyalty and campaigns for the whole organization" },
  DELIVERY_CONFIG: { group: "Business", label: "Delivery setup", description: "Delivery zones, fees, slots and express delivery" },
  STORE_SETTINGS: { group: "Business", label: "Store settings", description: "Edit store hours, contact and profile" },
  TEAM_MANAGE: { group: "Business", label: "Manage team", description: "Add staff and grant responsibilities" },
  REPORTS_VIEW: { group: "Business", label: "Reports", description: "Dashboard, store intelligence and customer insights" },
  FINANCE_MANAGE: { group: "Business", label: "Payments", description: "Payments, ledger and payouts" },
};

/** A member's full permission set: their role's preset plus the add-ons that role may hold */
export function effectivePermissions(role: string, addOns: readonly string[] = []): Permission[] {
  const preset = ROLE_PERMISSIONS[role] ?? [];
  const allowed = ROLE_ADDONS[role] ?? [];
  const extra = addOns.filter((p): p is Permission => allowed.includes(p as Permission));
  return [...new Set([...preset, ...extra])];
}

export function hasPermission(perms: readonly string[] | undefined, ...wanted: Permission[]): boolean {
  return !!perms && wanted.some((p) => perms.includes(p));
}
