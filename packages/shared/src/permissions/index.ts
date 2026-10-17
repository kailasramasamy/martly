import { Permission } from "../constants/index";
import { STAFF_ROLES } from "./roles";

export * from "./roles";

export type ResourceAction = "list" | "show" | "create" | "edit" | "delete";

/** Who can act: a permission (any of a list), any staff member, the org owner, a brand partner, or the platform admin */
type Requirement = Permission | readonly Permission[] | "STAFF" | "OWNER" | "BRAND" | "PLATFORM";
type Rule = Requirement | Partial<Record<ResourceAction, Requirement>>;

/** The identity a check runs against — the JWT payload or the /auth/me user both fit */
export interface PermissionSubject {
  role: string;
  permissions?: readonly string[];
}

const P = Permission;
const read = (req: Requirement, write: Requirement): Rule =>
  ({ list: req, show: req, create: write, edit: write, delete: write });

/** Resource → the requirement for each action. SUPER_ADMIN is implicitly granted everything. */
/** Any of these lets a member see the store's inventory (listings, stock and prices) */
export const INVENTORY_DUTIES = [
  P.LISTING_AVAILABILITY, P.LISTING_MANAGE, P.LISTING_PRICES, P.CATALOG_PRODUCTS,
  P.STOCK_VIEW, P.STOCK_RECEIVE, P.STOCK_COUNT, P.STOCK_ADJUST, P.STOCK_APPROVE,
];

export const RESOURCE_PERMISSIONS = {
  // Menu groups (containers only)
  inventory: "STAFF",
  marketing: "STAFF",
  delivery: "STAFF",
  operations: P.REPORTS_VIEW,
  notifications: P.MARKETING_MANAGE,

  // Daily operations
  dashboard: P.REPORTS_VIEW,
  orders: read(P.ORDERS_VIEW, [P.ORDERS_PROCESS, P.ORDERS_DISPATCH, P.ORDERS_CANCEL]),
  stock: P.STOCK_VIEW,
  "stock-counts": read([P.STOCK_COUNT, P.STOCK_APPROVE], [P.STOCK_COUNT, P.STOCK_APPROVE]),
  "stock-receive": P.STOCK_RECEIVE,
  // Seeing the store's inventory takes some listing, stock or catalog duty, so riders don't get it by default
  "store-products": {
    list: INVENTORY_DUTIES, show: INVENTORY_DUTIES, create: P.LISTING_MANAGE, delete: P.LISTING_MANAGE,
    edit: [P.LISTING_AVAILABILITY, P.LISTING_MANAGE, P.LISTING_PRICES, P.STOCK_ADJUST],
  },
  "delivery-board": read(P.ORDERS_VIEW, P.ORDERS_DISPATCH),
  riders: P.RIDERS_MANAGE,
  "return-requests": read(P.ORDERS_VIEW, P.RETURNS_HANDLE),
  "support-tickets": read(P.ORDERS_VIEW, P.SUPPORT_HANDLE),
  "store-intelligence": P.REPORTS_VIEW,
  "customer-insights": P.REPORTS_VIEW,

  // Organization
  organizations: "PLATFORM",
  users: P.TEAM_MANAGE,
  customers: { list: P.REFUNDS_ISSUE, show: P.REFUNDS_ISSUE, edit: P.REFUNDS_ISSUE, delete: "OWNER" },
  stores: { list: "STAFF", show: "STAFF", edit: P.STORE_SETTINGS, create: "OWNER", delete: "OWNER" },

  // Catalog
  categories: read("STAFF", "PLATFORM"),
  brands: read("STAFF", P.CATALOG_BRANDS),
  products: read("STAFF", P.CATALOG_PRODUCTS),
  "featured-products": P.LISTING_MANAGE,
  "catalog-drafts": P.CATALOG_PRODUCTS,
  collections: read("STAFF", P.CATALOG_COLLECTIONS),
  recipes: read("STAFF", P.CATALOG_COLLECTIONS),

  // Marketing
  banners: P.MARKETING_MANAGE,
  promos: P.MARKETING_MANAGE,
  "festival-events": { list: P.MARKETING_MANAGE },
  coupons: P.MARKETING_MANAGE,
  reviews: P.MARKETING_MANAGE,
  "review-analytics": P.MARKETING_MANAGE,
  "store-ratings": P.MARKETING_MANAGE,
  "notification-dashboard": P.MARKETING_MANAGE,
  "notification-campaigns": P.MARKETING_MANAGE,
  "notification-send": P.MARKETING_MANAGE,
  "notification-templates": P.MARKETING_MANAGE,
  "loyalty-settings": P.MARKETING_MANAGE,
  "loyalty-customers": P.MARKETING_MANAGE,
  "referral-settings": P.MARKETING_MANAGE,
  "referral-list": P.MARKETING_MANAGE,
  "membership-plans": P.MARKETING_MANAGE,
  "membership-subscribers": P.MARKETING_MANAGE,
  "subscription-config": P.MARKETING_MANAGE,
  subscriptions: P.MARKETING_MANAGE,
  // Paid marketing: members with marketing duty see the plan; only the owner buys
  "marketing-plan": { list: P.MARKETING_MANAGE, show: P.MARKETING_MANAGE, create: "OWNER", edit: "OWNER" },
  "brand-ads": { list: P.MARKETING_MANAGE, show: P.MARKETING_MANAGE, edit: "OWNER" },
  "marketing-pricing": "PLATFORM",
  "marketing-orders": "PLATFORM",
  "brand-campaigns": "PLATFORM",
  "brand-partners": "PLATFORM",

  // Brand portal (brand partners advertising across the network)
  "brand-portal": "BRAND",
  "brand-portal-campaigns": "BRAND",
  "brand-portal-invoices": "BRAND",

  // Delivery configuration
  "delivery-zones": P.DELIVERY_CONFIG,
  "delivery-tiers": P.DELIVERY_CONFIG,
  "delivery-slots": P.DELIVERY_CONFIG,
  // Fleet rules and slot rosters: who delivers when, and how big trips are
  "delivery-fleet": [P.DELIVERY_CONFIG, P.RIDERS_MANAGE],
  "express-delivery": P.DELIVERY_CONFIG,
} satisfies Record<string, Rule>;

export type Resource = keyof typeof RESOURCE_PERMISSIONS;

function meets(subject: PermissionSubject, req: Requirement): boolean {
  if (req === "PLATFORM") return false;
  if (req === "OWNER") return subject.role === "ORG_ADMIN";
  if (req === "BRAND") return subject.role === "BRAND_PARTNER";
  if (req === "STAFF") return (STAFF_ROLES as readonly string[]).includes(subject.role);
  const wanted: readonly string[] = typeof req === "string" ? [req] : req;
  return wanted.some((p) => subject.permissions?.includes(p));
}

export function can(
  subject: PermissionSubject | null | undefined,
  resource: Resource,
  action: ResourceAction = "list",
): boolean {
  if (!subject) return false;
  if (subject.role === "SUPER_ADMIN") return true;
  const rule: Rule = RESOURCE_PERMISSIONS[resource];
  const req = typeof rule === "string" || Array.isArray(rule) ? rule : (rule as Partial<Record<ResourceAction, Requirement>>)[action];
  return req !== undefined && meets(subject, req as Requirement);
}

/**
 * Catalog records are either master (organizationId null, platform-owned) or an organization's own.
 * The platform admin edits master records; members with the permission edit their own organization's.
 */
export function canEditCatalogRecord(
  subject: (PermissionSubject & { organizationId?: string | null }) | null | undefined,
  resource: Resource,
  record: { organizationId: string | null },
): boolean {
  if (!subject) return false;
  if (subject.role === "SUPER_ADMIN") return record.organizationId === null;
  return record.organizationId !== null && record.organizationId === subject.organizationId && can(subject, resource, "edit");
}

export function isResource(name: string): name is Resource {
  return name in RESOURCE_PERMISSIONS;
}

/** Whether the member gets the staff (Manage) side of the mobile app: any responsibility at all, riders' deliveries included */
export function canManage(subject: PermissionSubject | null | undefined): boolean {
  if (!subject) return false;
  if (subject.role === "SUPER_ADMIN") return true;
  return (subject.permissions?.length ?? 0) > 0;
}

/** Which permission each editable store-product field needs */
export const STORE_PRODUCT_FIELD_PERMISSIONS: Record<string, Permission> = {
  isActive: P.LISTING_AVAILABILITY,
  isFeatured: P.LISTING_MANAGE,
  price: P.LISTING_PRICES,
  memberPrice: P.LISTING_PRICES,
  discountType: P.LISTING_PRICES,
  discountValue: P.LISTING_PRICES,
  discountStart: P.LISTING_PRICES,
  discountEnd: P.LISTING_PRICES,
  stock: P.STOCK_ADJUST,
};

/** Fields in an update the member isn't allowed to change */
export function forbiddenStoreProductFields(subject: PermissionSubject, update: Record<string, unknown>): string[] {
  if (subject.role === "SUPER_ADMIN") return [];
  return Object.keys(update).filter((field) => {
    const needed = STORE_PRODUCT_FIELD_PERMISSIONS[field];
    return update[field] !== undefined && (!needed || !subject.permissions?.includes(needed));
  });
}

/** Whether the member may change this store-product field, so forms only offer what the API accepts */
export function canChangeStoreProductField(subject: PermissionSubject, field: string): boolean {
  return forbiddenStoreProductFields(subject, { [field]: true }).length === 0;
}
