import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { Refine, Authenticated, useGetIdentity, useLogout } from "@refinedev/core";
import { ThemedLayoutV2, useNotificationProvider } from "@refinedev/antd";
import routerProvider from "@refinedev/react-router";
import { BrowserRouter, Routes, Route, Outlet, Link, Navigate, useLocation } from "react-router";
import { App as AntdApp, Avatar, ConfigProvider, Typography, Space, Button, Spin } from "antd";
import {
  DashboardOutlined,
  BankOutlined,
  ShopOutlined,
  AppstoreOutlined,
  TagsOutlined,
  ShoppingCartOutlined,
  TrademarkOutlined,
  TeamOutlined,
  UserOutlined,
  LogoutOutlined,
  SunOutlined,
  MoonOutlined,
  InboxOutlined,
  ContainerOutlined,
  AuditOutlined,
  DownloadOutlined,
  StarOutlined,
  AppstoreAddOutlined,
  LayoutOutlined,
  GiftOutlined,
  CommentOutlined,
  EnvironmentOutlined,
  ThunderboltOutlined,
  RocketOutlined,
  CameraOutlined,
  CarOutlined,
  PictureOutlined,
  NotificationOutlined,
  UsergroupAddOutlined,
  CustomerServiceOutlined,
  RobotOutlined,
  FundOutlined,
  RollbackOutlined,
  CrownOutlined,
  CalendarOutlined,
  BookOutlined,
  DollarOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
  SolutionOutlined,
  WalletOutlined,
  SwapOutlined,
  TranslationOutlined,
} from "@ant-design/icons";

import "@refinedev/antd/dist/reset.css";
import "./overrides.css";

import { lightTheme, darkTheme } from "./theme";

type ThemeMode = "light" | "dark";
const ThemeModeContext = createContext<{ mode: ThemeMode; toggle: () => void }>({ mode: "light", toggle: () => {} });
import { authProvider } from "./providers/auth-provider";
import { martlyDataProvider } from "./providers/data-provider";
import { accessControlProvider } from "./providers/access-control";
import { LoginPage } from "./pages/login";
import { SelectOrgPage } from "./pages/select-org";
import { StoreList } from "./pages/stores/list";
import { StoreCreate } from "./pages/stores/create";
import { StoreEdit } from "./pages/stores/edit";
import { StoreShow } from "./pages/stores/show";
import { StoreOnboard } from "./pages/stores/onboard";
import { ProductList } from "./pages/products/list";
import { ProductCreate } from "./pages/products/create";
import { ProductEdit } from "./pages/products/edit";
import { ProductShow } from "./pages/products/show";
import { ProductMap } from "./pages/products/map";
import { OrderList } from "./pages/orders/list";
import { OrderShow } from "./pages/orders/show";
import { OrganizationList } from "./pages/organizations/list";
import { OrganizationCreate } from "./pages/organizations/create";
import { OrganizationEdit } from "./pages/organizations/edit";
import { StoreProductCreate } from "./pages/store-products/create";
import { StoreProductEdit } from "./pages/store-products/edit";
import { DashboardPage } from "./pages/dashboard";
import { StockPage } from "./pages/stock";
import { StockCountList } from "./pages/stock-counts/list";
import { StockCountShow } from "./pages/stock-counts/show";
import { StockReceivePage } from "./pages/stock-receive";
import { FeaturedProductsPage } from "./pages/featured-products";
import { CategoryList } from "./pages/categories/list";
import { CategoryCreate } from "./pages/categories/create";
import { CategoryEdit } from "./pages/categories/edit";
import { CategoryTree } from "./pages/categories/tree";
import { BrandList } from "./pages/brands/list";
import { BrandCreate } from "./pages/brands/create";
import { BrandEdit } from "./pages/brands/edit";
import { UserList } from "./pages/users/list";
import { UserCreate } from "./pages/users/create";
import { UserEdit } from "./pages/users/edit";
import { UserShow } from "./pages/users/show";
import { ProfilePage } from "./pages/profile";
import { CustomerList } from "./pages/customers/list";
import { CustomerShow } from "./pages/customers/show";
import { CollectionList } from "./pages/collections/list";
import { CollectionCreate } from "./pages/collections/create";
import { CollectionEdit } from "./pages/collections/edit";
import { HomeLayoutList } from "./pages/home-layout/list";
import { FestivalList } from "./pages/festival-calendar/list";
import { FestivalCreate } from "./pages/festival-calendar/create";
import { FestivalEdit } from "./pages/festival-calendar/edit";
import { GlossaryList } from "./pages/list-glossary/list";
import { GlossaryCreate } from "./pages/list-glossary/create";
import { GlossaryEdit } from "./pages/list-glossary/edit";
import { CouponList } from "./pages/coupons/list";
import { CouponCreate } from "./pages/coupons/create";
import { CouponEdit } from "./pages/coupons/edit";
import { ReviewList } from "./pages/reviews/list";
import { ReviewAnalytics } from "./pages/review-analytics/index";
import { StoreRatingList } from "./pages/store-ratings/list";
import { DeliveryZoneList } from "./pages/delivery-zones/list";
import { DeliveryZoneCreate } from "./pages/delivery-zones/create";
import { DeliveryZoneEdit } from "./pages/delivery-zones/edit";
import { DeliveryTierList } from "./pages/delivery-tiers/list";
import { DeliverySlotList } from "./pages/delivery-slots/list";
import { LoyaltySettings } from "./pages/loyalty/settings";
import { LoyaltyCustomers } from "./pages/loyalty/customers";
import { ExpressDeliveryConfig } from "./pages/express-delivery/config";
import { DeliveryBoard } from "./pages/delivery-board";
import { DeliveryFleet } from "./pages/delivery-fleet";
import { RidersList } from "./pages/riders/list";
import { CatalogDraftList } from "./pages/catalog-drafts/list";
import { CatalogDraftShow } from "./pages/catalog-drafts/show";
import { PromoList } from "./pages/promos/list";
import { PromoShow } from "./pages/promos/show";
import { PromoCreate } from "./pages/promos/create";
import { NotificationSend } from "./pages/notifications/send";
import { NotificationDashboard } from "./pages/notifications/dashboard";
import { CampaignList as NotificationCampaignList } from "./pages/notifications/campaigns/list";
import { CampaignShow as NotificationCampaignShow } from "./pages/notifications/campaigns/show";
import { TemplateList } from "./pages/notifications/templates/list";
import { TemplateCreate } from "./pages/notifications/templates/create";
import { TemplateEdit } from "./pages/notifications/templates/edit";
import { ReferralSettings } from "./pages/referrals/settings";
import { ReferralList } from "./pages/referrals/list";
import { SupportTicketList } from "./pages/support-tickets/list";
import { SupportTicketShow } from "./pages/support-tickets/show";
import { ReturnRequestList } from "./pages/return-requests/list";
import { ReturnRequestShow } from "./pages/return-requests/show";
import { StoreIntelligencePage } from "./pages/store-intelligence";
import { CustomerInsightsPage } from "./pages/customer-insights";
import { MembershipPlans } from "./pages/memberships/plans";
import { MembershipSubscribers } from "./pages/memberships/subscribers";
import { SubscriptionConfig } from "./pages/subscription-config/index";
import { SubscriptionList } from "./pages/subscriptions/list";
import { SubscriptionShow } from "./pages/subscriptions/show";
import { RecipeList } from "./pages/recipes/list";
import { RecipeCreate } from "./pages/recipes/create";
import { RecipeEdit } from "./pages/recipes/edit";
import { MarketingPlan } from "./pages/marketing/plan";
import { MarketingPricing } from "./pages/marketing/pricing";
import { MarketingRevenue } from "./pages/marketing/revenue";
import { CampaignList } from "./pages/brand-campaigns/list";
import { CampaignForm } from "./pages/brand-campaigns/form";
import { CampaignShow } from "./pages/brand-campaigns/show";
import { BrandPartners } from "./pages/brand-campaigns/partners";
import { BrandInvoices } from "./pages/brand-portal/invoices";
import { BRAND_SCOPE, PLATFORM_SCOPE } from "./pages/brand-campaigns/types";
import { LedgerPage } from "./pages/finance/ledger";
import { SettlementsPage } from "./pages/finance/settlements";
import { PayoutAccountPage } from "./pages/finance/payout-account";
import { PlatformPayoutsPage } from "./pages/finance/platform";
import { OrgSwitcher } from "./components/OrgSwitcher";
import { NotificationBell } from "./components/notifications/NotificationBell";
import { UserRoleLabels, type UserRole } from "@martly/shared/constants";

const { Text } = Typography;


function HeaderBar() {
  const { data: identity } = useGetIdentity<{ name: string; role: string; brand?: { name: string; imageUrl: string | null } | null }>();
  const { mutate: logout } = useLogout();
  const { mode, toggle } = useContext(ThemeModeContext);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 24px", height: 48, background: "#0d9488" }}>
      {identity?.brand ? (
        <Space size={8}>
          <Avatar size={28} src={identity.brand.imageUrl}>{identity.brand.name[0]}</Avatar>
          <Text style={{ color: "#fff", fontWeight: 600 }}>{identity.brand.name}</Text>
        </Space>
      ) : (
        <OrgSwitcher />
      )}
      <Space size={12}>
        {identity && (
          <Link to="/profile" title="My profile">
            <Space size={6}>
              <UserOutlined style={{ color: "rgba(255,255,255,0.85)" }} />
              <Text style={{ color: "#fff", fontSize: 13 }}>{identity.name}</Text>
              <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>
                {UserRoleLabels[identity.role as UserRole] ?? identity.role}
              </Text>
            </Space>
          </Link>
        )}
        {identity && <NotificationBell />}
        <Button
          type="text"
          size="small"
          icon={mode === "light" ? <MoonOutlined /> : <SunOutlined />}
          onClick={toggle}
          title={mode === "light" ? "Dark mode" : "Light mode"}
          style={{ color: "rgba(255,255,255,0.85)" }}
        />
        <Button
          type="text"
          size="small"
          icon={<LogoutOutlined />}
          onClick={() => logout()}
          style={{ color: "rgba(255,255,255,0.75)" }}
        />
      </Space>
    </div>
  );
}

function HomeRoute() {
  const { data: identity, isLoading } = useGetIdentity<{ role: string }>();
  if (isLoading) return <Spin style={{ display: "block", margin: "64px auto" }} />;
  if (identity?.role === "BRAND_PARTNER") return <Navigate to="/brand-portal/campaigns" replace />;
  return <DashboardPage />;
}

/** Each page opens at the top; the browser would otherwise keep the previous page's scroll position */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const [mode, setMode] = useState<ThemeMode>(
    () => (localStorage.getItem("martly_theme") as ThemeMode) || "light",
  );
  const toggle = useCallback(() => {
    setMode((prev) => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem("martly_theme", next);
      return next;
    });
  }, []);

  return (
    <BrowserRouter>
      <ThemeModeContext.Provider value={{ mode, toggle }}>
      <ConfigProvider theme={mode === "light" ? lightTheme : darkTheme}>
        <AntdApp>
          <Refine
            routerProvider={routerProvider}
            dataProvider={martlyDataProvider}
            authProvider={authProvider}
            accessControlProvider={accessControlProvider}
            notificationProvider={useNotificationProvider}
            resources={[
              {
                name: "dashboard",
                list: "/",
                meta: { label: "Dashboard", icon: <DashboardOutlined /> },
              },
              {
                name: "organizations",
                list: "/organizations",
                create: "/organizations/create",
                edit: "/organizations/edit/:id",
                meta: { label: "Organizations", icon: <BankOutlined /> },
              },
              {
                name: "users",
                list: "/users",
                create: "/users/create",
                edit: "/users/edit/:id",
                show: "/users/show/:id",
                meta: { label: "Users", icon: <TeamOutlined /> },
              },
              {
                name: "customers",
                list: "/customers",
                show: "/customers/show/:id",
                meta: { label: "Customers", icon: <UserOutlined /> },
              },
              {
                name: "stores",
                list: "/stores",
                create: "/stores/create",
                edit: "/stores/edit/:id",
                show: "/stores/show/:id",
                meta: { label: "Stores", icon: <ShopOutlined /> },
              },
              {
                name: "inventory",
                meta: { label: "Inventory", icon: <InboxOutlined /> },
              },
              {
                name: "categories",
                list: "/categories",
                create: "/categories/create",
                edit: "/categories/edit/:id",
                meta: { label: "Categories", icon: <AppstoreOutlined />, parent: "inventory" },
              },
              {
                name: "brands",
                list: "/brands",
                create: "/brands/create",
                edit: "/brands/edit/:id",
                meta: { label: "Brands", icon: <TrademarkOutlined />, parent: "inventory" },
              },
              {
                name: "catalog-drafts",
                list: "/catalog-drafts",
                show: "/catalog-drafts/show/:id",
                meta: { label: "Catalog agent", icon: <CameraOutlined />, parent: "inventory" },
              },
              {
                name: "products",
                list: "/products",
                create: "/products/create",
                edit: "/products/edit/:id",
                show: "/products/show/:id",
                meta: { label: "Products", icon: <TagsOutlined />, parent: "inventory" },
              },
              {
                name: "featured-products",
                list: "/featured-products",
                meta: { label: "Featured", icon: <StarOutlined />, parent: "inventory" },
              },
              {
                name: "marketing",
                meta: { label: "Marketing", icon: <AppstoreAddOutlined /> },
              },
              {
                name: "collections",
                list: "/collections",
                create: "/collections/create",
                edit: "/collections/edit/:id",
                meta: { label: "Collections", icon: <AppstoreOutlined />, parent: "marketing" },
              },
              {
                name: "home-layout",
                list: "/home-layout",
                meta: { label: "Home layout", icon: <LayoutOutlined />, parent: "marketing" },
              },
              {
                name: "promos",
                list: "/promos",
                create: "/promos/create",
                show: "/promos/show/:id",
                meta: { label: "Promotions", icon: <RocketOutlined />, parent: "marketing" },
              },
              {
                name: "list-glossary",
                list: "/list-glossary",
                create: "/list-glossary/create",
                edit: "/list-glossary/edit/:id",
                meta: { label: "List glossary", icon: <TranslationOutlined />, parent: "inventory" },
              },
              {
                name: "festival-events",
                list: "/festival-calendar",
                create: "/festival-calendar/create",
                edit: "/festival-calendar/edit/:id",
                meta: { label: "Festival Calendar", icon: <CalendarOutlined />, parent: "marketing" },
              },
              {
                name: "coupons",
                list: "/coupons",
                create: "/coupons/create",
                edit: "/coupons/edit/:id",
                meta: { label: "Coupons", icon: <GiftOutlined />, parent: "marketing" },
              },
              {
                name: "reviews",
                list: "/reviews",
                meta: { label: "Reviews", icon: <CommentOutlined />, parent: "marketing" },
              },
              {
                name: "review-analytics",
                list: "/review-analytics",
                meta: { label: "Review Analytics", icon: <StarOutlined />, parent: "marketing" },
              },
              {
                name: "store-ratings",
                list: "/store-ratings",
                meta: { label: "Store Ratings", icon: <ShopOutlined />, parent: "marketing" },
              },
              {
                name: "notifications",
                meta: { label: "Notifications", icon: <NotificationOutlined />, parent: "marketing" },
              },
              {
                name: "notification-dashboard",
                list: "/notifications/dashboard",
                meta: { label: "Dashboard", parent: "notifications" },
              },
              {
                name: "notification-campaigns",
                list: "/notifications/campaigns",
                show: "/notifications/campaigns/show/:id",
                meta: { label: "Campaigns", parent: "notifications" },
              },
              {
                name: "notification-send",
                list: "/notifications/send",
                meta: { label: "Send", parent: "notifications" },
              },
              {
                name: "notification-templates",
                list: "/notifications/templates",
                create: "/notifications/templates/create",
                edit: "/notifications/templates/edit/:id",
                meta: { label: "Templates", parent: "notifications" },
              },
              {
                name: "loyalty-settings",
                list: "/loyalty-settings",
                meta: { label: "Loyalty Settings", icon: <StarOutlined />, parent: "marketing" },
              },
              {
                name: "loyalty-customers",
                list: "/loyalty-customers",
                meta: { label: "Loyalty Points", icon: <StarOutlined />, parent: "marketing" },
              },
              {
                name: "referral-settings",
                list: "/referral-settings",
                meta: { label: "Referral Settings", icon: <UsergroupAddOutlined />, parent: "marketing" },
              },
              {
                name: "referral-list",
                list: "/referral-list",
                meta: { label: "Referrals", icon: <UsergroupAddOutlined />, parent: "marketing" },
              },
              {
                name: "membership-plans",
                list: "/membership-plans",
                meta: { label: "Membership Plans", icon: <CrownOutlined />, parent: "marketing" },
              },
              {
                name: "membership-subscribers",
                list: "/membership-subscribers",
                meta: { label: "Subscribers", icon: <CrownOutlined />, parent: "marketing" },
              },
              {
                name: "subscription-config",
                list: "/subscription-config",
                meta: { label: "Subscription Config", icon: <CalendarOutlined />, parent: "marketing" },
              },
              {
                name: "subscriptions",
                list: "/subscriptions",
                show: "/subscriptions/show/:id",
                meta: { label: "Subscriptions", icon: <CalendarOutlined />, parent: "marketing" },
              },
              {
                name: "recipes",
                list: "/recipes",
                create: "/recipes/create",
                edit: "/recipes/edit/:id",
                meta: { label: "Recipes", icon: <BookOutlined />, parent: "marketing" },
              },
              {
                name: "marketing-plan",
                list: "/marketing-plan",
                meta: { label: "Marketing plan", icon: <DollarOutlined />, parent: "marketing" },
              },
              {
                name: "marketing-pricing",
                list: "/marketing-pricing",
                meta: { label: "Ad pricing", icon: <TagsOutlined />, parent: "marketing" },
              },
              {
                name: "marketing-orders",
                list: "/marketing-orders",
                meta: { label: "Marketing revenue", icon: <FundOutlined />, parent: "marketing" },
              },
              {
                name: "brand-campaigns",
                list: "/brand-campaigns",
                create: "/brand-campaigns/create",
                edit: "/brand-campaigns/edit/:id",
                show: "/brand-campaigns/show/:id",
                meta: { label: "Brand campaigns", icon: <TrademarkOutlined />, parent: "marketing" },
              },
              {
                name: "brand-partners",
                list: "/brand-partners",
                meta: { label: "Brand partners", icon: <SolutionOutlined />, parent: "marketing" },
              },
              {
                name: "brand-portal",
                meta: { label: "Brand portal", icon: <SafetyCertificateOutlined /> },
              },
              {
                name: "brand-portal-campaigns",
                list: "/brand-portal/campaigns",
                create: "/brand-portal/campaigns/create",
                edit: "/brand-portal/campaigns/edit/:id",
                show: "/brand-portal/campaigns/show/:id",
                meta: { label: "Campaigns", icon: <PictureOutlined />, parent: "brand-portal" },
              },
              {
                name: "brand-portal-invoices",
                list: "/brand-portal/invoices",
                meta: { label: "Invoices", icon: <FileTextOutlined />, parent: "brand-portal" },
              },
              {
                name: "finance",
                meta: { label: "Finance", icon: <WalletOutlined /> },
              },
              {
                name: "ledger",
                list: "/ledger",
                meta: { label: "Ledger", icon: <BankOutlined />, parent: "finance" },
              },
              {
                name: "settlements",
                list: "/settlements",
                meta: { label: "Settlements", icon: <SwapOutlined />, parent: "finance" },
              },
              {
                name: "payout-account",
                list: "/payout-account",
                meta: { label: "Payout account", icon: <SolutionOutlined />, parent: "finance" },
              },
              {
                name: "ledger-balances",
                list: "/ledger-balances",
                meta: { label: "Payouts (platform)", icon: <DollarOutlined />, parent: "finance" },
              },
              {
                name: "delivery",
                meta: { label: "Delivery", icon: <EnvironmentOutlined /> },
              },
              {
                name: "delivery-board",
                list: "/delivery-board",
                meta: { label: "Delivery Board", icon: <CarOutlined />, parent: "delivery" },
              },
              {
                name: "riders",
                list: "/riders",
                meta: { label: "Riders", icon: <TeamOutlined />, parent: "delivery" },
              },
              {
                name: "delivery-zones",
                list: "/delivery-zones",
                create: "/delivery-zones/create",
                edit: "/delivery-zones/edit/:id",
                meta: { label: "Zones (Pincode)", parent: "delivery" },
              },
              {
                name: "delivery-tiers",
                list: "/delivery-tiers",
                meta: { label: "Tiers (Distance)", parent: "delivery" },
              },
              {
                name: "delivery-slots",
                list: "/delivery-slots",
                meta: { label: "Time Slots", parent: "delivery" },
              },
              {
                name: "delivery-fleet",
                list: "/delivery-fleet",
                meta: { label: "Riders & Trips", icon: <CarOutlined />, parent: "delivery" },
              },
              {
                name: "express-delivery",
                list: "/express-delivery",
                meta: { label: "Express Config", icon: <ThunderboltOutlined />, parent: "delivery" },
              },
              {
                name: "store-products",
                create: "/store-products/create",
                edit: "/store-products/edit/:id",
              },
              {
                name: "stock",
                list: "/stock",
                meta: { label: "Stock Management", icon: <ContainerOutlined />, parent: "inventory" },
              },
              {
                name: "stock-counts",
                list: "/stock-counts",
                show: "/stock-counts/:id",
                meta: { label: "Stock Counts", icon: <AuditOutlined />, parent: "inventory" },
              },
              {
                name: "stock-receive",
                list: "/stock-receive",
                meta: { label: "Receive Stock", icon: <DownloadOutlined />, parent: "inventory" },
              },
              {
                name: "orders",
                list: "/orders",
                show: "/orders/show/:id",
                meta: { label: "Orders", icon: <ShoppingCartOutlined /> },
              },
              {
                name: "return-requests",
                list: "/return-requests",
                show: "/return-requests/show/:id",
                meta: { label: "Returns", icon: <RollbackOutlined /> },
              },
              {
                name: "support-tickets",
                list: "/support-tickets",
                show: "/support-tickets/show/:id",
                meta: { label: "Support Tickets", icon: <CustomerServiceOutlined /> },
              },
              {
                name: "operations",
                meta: { label: "Operations", icon: <RobotOutlined /> },
              },
              {
                name: "store-intelligence",
                list: "/store-intelligence",
                meta: { label: "Store Intelligence", icon: <FundOutlined />, parent: "operations" },
              },
              {
                name: "customer-insights",
                list: "/customer-insights",
                meta: { label: "Customer Insights", icon: <TeamOutlined />, parent: "operations" },
              },
            ]}
          >
            <Routes>
              <Route
                element={
                  <Authenticated key="auth" redirectOnFail="/login">
                    <ThemedLayoutV2
                      Title={({ collapsed }: { collapsed: boolean }) =>
                        collapsed ? (
                          <img src="/martly-icon.png" alt="Martly" style={{ height: 28, objectFit: "contain" }} />
                        ) : (
                          <img src="/martly-logo-full.png" alt="Martly" style={{ maxWidth: 160, height: "auto", objectFit: "contain" }} />
                        )
                      }
                      Header={HeaderBar}
                    >
                      <ScrollToTop />
                      <Outlet />
                    </ThemedLayoutV2>
                  </Authenticated>
                }
              >
                <Route path="/organizations">
                  <Route index element={<OrganizationList />} />
                  <Route path="create" element={<OrganizationCreate />} />
                  <Route path="edit/:id" element={<OrganizationEdit />} />
                </Route>
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/users">
                  <Route index element={<UserList />} />
                  <Route path="create" element={<UserCreate />} />
                  <Route path="edit/:id" element={<UserEdit />} />
                  <Route path="show/:id" element={<UserShow />} />
                </Route>
                <Route path="/customers">
                  <Route index element={<CustomerList />} />
                  <Route path="show/:id" element={<CustomerShow />} />
                </Route>
                <Route path="/stores">
                  <Route index element={<StoreList />} />
                  <Route path="create" element={<StoreCreate />} />
                  <Route path="edit/:id" element={<StoreEdit />} />
                  <Route path="show/:id" element={<StoreShow />} />
                  <Route path="show/:id/onboard" element={<StoreOnboard />} />
                </Route>
                <Route path="/categories">
                  <Route index element={<CategoryList />} />
                  <Route path="create" element={<CategoryCreate />} />
                  <Route path="edit/:id" element={<CategoryEdit />} />
                  <Route path="tree" element={<CategoryTree />} />
                </Route>
                <Route path="/brands">
                  <Route index element={<BrandList />} />
                  <Route path="create" element={<BrandCreate />} />
                  <Route path="edit/:id" element={<BrandEdit />} />
                </Route>
                <Route path="/catalog-drafts">
                  <Route index element={<CatalogDraftList />} />
                  <Route path="show/:id" element={<CatalogDraftShow />} />
                </Route>
                <Route path="/products">
                  <Route index element={<ProductList />} />
                  <Route path="create" element={<ProductCreate />} />
                  <Route path="edit/:id" element={<ProductEdit />} />
                  <Route path="show/:id" element={<ProductShow />} />
                  <Route path=":id/map" element={<ProductMap />} />
                </Route>
                <Route path="/store-products">
                  <Route path="create" element={<StoreProductCreate />} />
                  <Route path="edit/:id" element={<StoreProductEdit />} />
                </Route>
                <Route path="/orders">
                  <Route index element={<OrderList />} />
                  <Route path="show/:id" element={<OrderShow />} />
                </Route>
                <Route path="/return-requests">
                  <Route index element={<ReturnRequestList />} />
                  <Route path="show/:id" element={<ReturnRequestShow />} />
                </Route>
                <Route path="/support-tickets">
                  <Route index element={<SupportTicketList />} />
                  <Route path="show/:id" element={<SupportTicketShow />} />
                </Route>
                <Route path="/promos">
                  <Route index element={<PromoList />} />
                  <Route path="create" element={<PromoCreate />} />
                  <Route path="show/:id" element={<PromoShow />} />
                </Route>
                <Route path="/ledger" element={<LedgerPage />} />
                <Route path="/settlements" element={<SettlementsPage />} />
                <Route path="/payout-account" element={<PayoutAccountPage />} />
                <Route path="/ledger-balances" element={<PlatformPayoutsPage />} />
                <Route path="/marketing-plan" element={<MarketingPlan />} />
                <Route path="/marketing-pricing" element={<MarketingPricing />} />
                <Route path="/marketing-orders" element={<MarketingRevenue />} />
                <Route path="/brand-campaigns">
                  <Route index element={<CampaignList scope={PLATFORM_SCOPE} />} />
                  <Route path="create" element={<CampaignForm scope={PLATFORM_SCOPE} />} />
                  <Route path="edit/:id" element={<CampaignForm scope={PLATFORM_SCOPE} />} />
                  <Route path="show/:id" element={<CampaignShow scope={PLATFORM_SCOPE} />} />
                </Route>
                <Route path="/brand-partners" element={<BrandPartners />} />
                <Route path="/brand-portal">
                  <Route path="campaigns" element={<CampaignList scope={BRAND_SCOPE} />} />
                  <Route path="campaigns/create" element={<CampaignForm scope={BRAND_SCOPE} />} />
                  <Route path="campaigns/edit/:id" element={<CampaignForm scope={BRAND_SCOPE} />} />
                  <Route path="campaigns/show/:id" element={<CampaignShow scope={BRAND_SCOPE} />} />
                  <Route path="invoices" element={<BrandInvoices />} />
                </Route>
                <Route path="/collections">
                  <Route index element={<CollectionList />} />
                  <Route path="create" element={<CollectionCreate />} />
                  <Route path="edit/:id" element={<CollectionEdit />} />
                </Route>
                <Route path="/home-layout" element={<HomeLayoutList />} />
                <Route path="/festival-calendar">
                  <Route index element={<FestivalList />} />
                  <Route path="create" element={<FestivalCreate />} />
                  <Route path="edit/:id" element={<FestivalEdit />} />
                </Route>
                <Route path="/list-glossary">
                  <Route index element={<GlossaryList />} />
                  <Route path="create" element={<GlossaryCreate />} />
                  <Route path="edit/:id" element={<GlossaryEdit />} />
                </Route>
                <Route path="/coupons">
                  <Route index element={<CouponList />} />
                  <Route path="create" element={<CouponCreate />} />
                  <Route path="edit/:id" element={<CouponEdit />} />
                </Route>
                <Route path="/reviews" element={<ReviewList />} />
                <Route path="/review-analytics" element={<ReviewAnalytics />} />
                <Route path="/store-ratings" element={<StoreRatingList />} />
                <Route path="/notifications">
                  <Route path="dashboard" element={<NotificationDashboard />} />
                  <Route path="campaigns" element={<NotificationCampaignList />} />
                  <Route path="campaigns/show/:id" element={<NotificationCampaignShow />} />
                  <Route path="send" element={<NotificationSend />} />
                  <Route path="templates" element={<TemplateList />} />
                  <Route path="templates/create" element={<TemplateCreate />} />
                  <Route path="templates/edit/:id" element={<TemplateEdit />} />
                </Route>
                <Route path="/loyalty-settings" element={<LoyaltySettings />} />
                <Route path="/loyalty-customers" element={<LoyaltyCustomers />} />
                <Route path="/referral-settings" element={<ReferralSettings />} />
                <Route path="/referral-list" element={<ReferralList />} />
                <Route path="/delivery-zones">
                  <Route index element={<DeliveryZoneList />} />
                  <Route path="create" element={<DeliveryZoneCreate />} />
                  <Route path="edit/:id" element={<DeliveryZoneEdit />} />
                </Route>
                <Route path="/delivery-tiers" element={<DeliveryTierList />} />
                <Route path="/delivery-slots" element={<DeliverySlotList />} />
                <Route path="/delivery-fleet" element={<DeliveryFleet />} />
                <Route path="/express-delivery" element={<ExpressDeliveryConfig />} />
                <Route path="/delivery-board" element={<DeliveryBoard />} />
                <Route path="/riders" element={<RidersList />} />
                <Route path="/stock" element={<StockPage />} />
                <Route path="/stock-counts">
                  <Route index element={<StockCountList />} />
                  <Route path=":id" element={<StockCountShow />} />
                </Route>
                <Route path="/stock-receive" element={<StockReceivePage />} />
                <Route path="/featured-products" element={<FeaturedProductsPage />} />
                <Route path="/store-intelligence" element={<StoreIntelligencePage />} />
                <Route path="/customer-insights" element={<CustomerInsightsPage />} />
                <Route path="/membership-plans" element={<MembershipPlans />} />
                <Route path="/membership-subscribers" element={<MembershipSubscribers />} />
                <Route path="/recipes">
                  <Route index element={<RecipeList />} />
                  <Route path="create" element={<RecipeCreate />} />
                  <Route path="edit/:id" element={<RecipeEdit />} />
                </Route>
                <Route path="/subscription-config" element={<SubscriptionConfig />} />
                <Route path="/subscriptions">
                  <Route index element={<SubscriptionList />} />
                  <Route path="show/:id" element={<SubscriptionShow />} />
                </Route>
                <Route path="/" element={<HomeRoute />} />
              </Route>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/select-org" element={<SelectOrgPage />} />
            </Routes>
          </Refine>
        </AntdApp>
      </ConfigProvider>
      </ThemeModeContext.Provider>
    </BrowserRouter>
  );
}
