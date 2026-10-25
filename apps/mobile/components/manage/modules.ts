import type { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { can, type Resource } from "@martly/shared/permissions";

export interface ManageModule {
  resource: Resource;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: Href;
}

interface ModuleGroup {
  title: string;
  modules: ManageModule[];
}

const MODULE_GROUPS: ModuleGroup[] = [
  {
    title: "Service",
    modules: [
      { resource: "return-requests", label: "Return requests", icon: "return-down-back-outline", href: "/manage/return-requests" },
      { resource: "support-tickets", label: "Support tickets", icon: "headset-outline", href: "/manage/support-tickets" },
      { resource: "reviews", label: "Reviews", icon: "star-outline", href: "/manage/reviews" },
      { resource: "store-ratings", label: "Store ratings", icon: "ribbon-outline", href: "/manage/store-ratings" },
    ],
  },
  {
    title: "Insights",
    modules: [
      { resource: "store-intelligence", label: "Store intelligence", icon: "bulb-outline", href: "/manage/store-intelligence" },
      { resource: "customer-insights", label: "Customer insights", icon: "analytics-outline", href: "/manage/customer-insights" },
      { resource: "review-analytics", label: "Review analytics", icon: "bar-chart-outline", href: "/manage/review-analytics" },
    ],
  },
  {
    title: "People",
    modules: [
      { resource: "customers", label: "Customers", icon: "people-outline", href: "/manage/customers" },
      { resource: "riders", label: "Riders", icon: "bicycle-outline", href: "/manage/riders" },
      { resource: "users", label: "Team & users", icon: "id-card-outline", href: "/manage/users" },
    ],
  },
  {
    title: "Stock",
    modules: [
      { resource: "stock-counts", label: "Stock counts", icon: "clipboard-outline", href: "/manage/stock-counts" },
      { resource: "stock-receive", label: "Receive stock", icon: "download-outline", href: "/manage/stock/receive" },
    ],
  },
  {
    title: "Product catalog",
    modules: [
      { resource: "catalog-drafts", label: "Add product", icon: "add-circle-outline", href: "/manage/add-product" },
      { resource: "catalog-drafts", label: "AI queue", icon: "sparkles-outline", href: "/manage/catalog-drafts" },
      { resource: "products", label: "Products", icon: "cube-outline", href: "/manage/products" },
      { resource: "categories", label: "Categories", icon: "file-tray-stacked-outline", href: "/manage/categories" },
      { resource: "brands", label: "Brands", icon: "pricetag-outline", href: "/manage/brands" },
      { resource: "collections", label: "Collections", icon: "albums-outline", href: "/manage/collections" },
      { resource: "featured-products", label: "Featured products", icon: "sparkles-outline", href: "/manage/featured-products" },
      { resource: "recipes", label: "Recipes", icon: "restaurant-outline", href: "/manage/recipes" },
    ],
  },
  {
    title: "Marketing",
    modules: [
      { resource: "coupons", label: "Coupons", icon: "ticket-outline", href: "/manage/coupons" },
      { resource: "promos", label: "Promotions", icon: "megaphone-outline", href: "/manage/promos" },
      { resource: "home-layout", label: "Home layout", icon: "grid-outline", href: "/manage/home-layout" },
      { resource: "store-posts", label: "Shop posts", icon: "chatbubble-ellipses-outline", href: "/manage/store-posts" },
      { resource: "festival-events", label: "Festival calendar", icon: "calendar-outline", href: "/manage/festival-events" },
      { resource: "notification-send", label: "Push notifications", icon: "notifications-outline", href: "/manage/notification-send" },
      { resource: "loyalty-settings", label: "Loyalty", icon: "medal-outline", href: "/manage/loyalty-settings" },
      { resource: "referral-settings", label: "Referrals", icon: "gift-outline", href: "/manage/referral-settings" },
      { resource: "membership-plans", label: "Memberships", icon: "diamond-outline", href: "/manage/membership-plans" },
      { resource: "subscriptions", label: "Subscriptions", icon: "repeat-outline", href: "/manage/subscriptions" },
      { resource: "marketing-plan", label: "Marketing plan", icon: "rocket-outline", href: "/manage/marketing-plan" },
      { resource: "brand-ads", label: "Brand ads", icon: "pricetags-outline", href: "/manage/brand-ads" },
    ],
  },
  {
    title: "Delivery setup",
    modules: [
      { resource: "delivery-zones", label: "Delivery zones", icon: "map-outline", href: "/manage/delivery-zones" },
      { resource: "delivery-slots", label: "Time slots", icon: "time-outline", href: "/manage/delivery-slots" },
      { resource: "delivery-tiers", label: "Delivery fees", icon: "cash-outline", href: "/manage/delivery-tiers" },
      { resource: "delivery-fleet", label: "Riders & trips", icon: "people-outline", href: "/manage/delivery-fleet" },
      { resource: "express-delivery", label: "Express delivery", icon: "flash-outline", href: "/manage/express-delivery" },
    ],
  },
  {
    title: "Organization",
    modules: [
      { resource: "stores", label: "Stores", icon: "storefront-outline", href: "/manage/stores" },
      { resource: "finance", label: "Payments & payouts", icon: "cash-outline", href: "/manage/finance" },
      { resource: "organizations", label: "Organizations", icon: "business-outline", href: "/manage/organizations" },
    ],
  },
  {
    // Martly's own ad business; the PLATFORM requirement keeps it to super admin
    title: "Platform",
    modules: [
      { resource: "brand-campaigns", label: "Brand campaigns", icon: "megaphone-outline", href: "/manage/brand-campaigns" },
      { resource: "brand-partners", label: "Brand partners", icon: "people-circle-outline", href: "/manage/brand-partners" },
      { resource: "marketing-pricing", label: "Ad pricing", icon: "pricetag-outline", href: "/manage/ad-pricing" },
      { resource: "marketing-orders", label: "Marketing revenue", icon: "trending-up-outline", href: "/manage/marketing-revenue" },
    ],
  },
];

// An organisation's own marketing; Martly runs pricing and brand campaigns from the web admin, as admin hides these too
const ORG_MARKETING: Resource[] = ["marketing-plan", "brand-ads"];

/** Module groups visible to a user; empty groups are dropped */
export function modulesFor(user: { role: string; permissions?: readonly string[] } | null): ModuleGroup[] {
  const shown = (m: ManageModule) => can(user, m.resource) && !(user?.role === "SUPER_ADMIN" && ORG_MARKETING.includes(m.resource));
  return MODULE_GROUPS
    .map((g) => ({ ...g, modules: g.modules.filter(shown) }))
    .filter((g) => g.modules.length > 0);
}
