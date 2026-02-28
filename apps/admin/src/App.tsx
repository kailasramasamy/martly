import { createContext, useContext, useState, useCallback } from "react";
import { Refine, Authenticated, useGetIdentity, useLogout } from "@refinedev/core";
import { ThemedLayoutV2, useNotificationProvider } from "@refinedev/antd";
import routerProvider from "@refinedev/react-router";
import { BrowserRouter, Routes, Route, Outlet } from "react-router";
import { App as AntdApp, ConfigProvider, Typography, Space, Button } from "antd";
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
  StarOutlined,
  AppstoreAddOutlined,
  GiftOutlined,
  CommentOutlined,
  EnvironmentOutlined,
  ThunderboltOutlined,
  CarOutlined,
  PictureOutlined,
  NotificationOutlined,
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
import { CustomerList } from "./pages/customers/list";
import { CustomerShow } from "./pages/customers/show";
import { CollectionList } from "./pages/collections/list";
import { CollectionCreate } from "./pages/collections/create";
import { CollectionEdit } from "./pages/collections/edit";
import { CouponList } from "./pages/coupons/list";
import { CouponCreate } from "./pages/coupons/create";
import { CouponEdit } from "./pages/coupons/edit";
import { ReviewList } from "./pages/reviews/list";
import { DeliveryZoneList } from "./pages/delivery-zones/list";
import { DeliveryZoneCreate } from "./pages/delivery-zones/create";
import { DeliveryZoneEdit } from "./pages/delivery-zones/edit";
import { DeliveryTierList } from "./pages/delivery-tiers/list";
import { DeliverySlotList } from "./pages/delivery-slots/list";
import { LoyaltySettings } from "./pages/loyalty/settings";
import { LoyaltyCustomers } from "./pages/loyalty/customers";
import { ExpressDeliveryConfig } from "./pages/express-delivery/config";
import { DeliveryBoard } from "./pages/delivery-board";
import { RidersList } from "./pages/riders/list";
import { BannerList } from "./pages/banners/list";
import { BannerCreate } from "./pages/banners/create";
import { BannerEdit } from "./pages/banners/edit";
import { NotificationSend } from "./pages/notifications/send";
import { NotificationDashboard } from "./pages/notifications/dashboard";
import { CampaignList } from "./pages/notifications/campaigns/list";
import { CampaignShow } from "./pages/notifications/campaigns/show";
import { TemplateList } from "./pages/notifications/templates/list";
import { TemplateCreate } from "./pages/notifications/templates/create";
import { TemplateEdit } from "./pages/notifications/templates/edit";
import { OrgSwitcher } from "./components/OrgSwitcher";

const { Text } = Typography;

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ORG_ADMIN: "Org Admin",
  STORE_MANAGER: "Store Manager",
  STAFF: "Staff",
  CUSTOMER: "Customer",
};

function HeaderBar() {
  const { data: identity } = useGetIdentity<{ name: string; role: string }>();
  const { mutate: logout } = useLogout();
  const { mode, toggle } = useContext(ThemeModeContext);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 24px", height: 48, background: "#0d9488" }}>
      <OrgSwitcher />
      <Space size={12}>
        {identity && (
          <Space size={6}>
            <UserOutlined style={{ color: "rgba(255,255,255,0.85)" }} />
            <Text style={{ color: "#fff", fontSize: 13 }}>{identity.name}</Text>
            <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>
              {ROLE_LABELS[identity.role] ?? identity.role}
            </Text>
          </Space>
        )}
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
                name: "banners",
                list: "/banners",
                create: "/banners/create",
                edit: "/banners/edit/:id",
                meta: { label: "Banners", icon: <PictureOutlined />, parent: "marketing" },
              },
              {
                name: "collections",
                list: "/collections",
                create: "/collections/create",
                edit: "/collections/edit/:id",
                meta: { label: "Collections", icon: <AppstoreOutlined />, parent: "marketing" },
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
                name: "orders",
                list: "/orders",
                show: "/orders/show/:id",
                meta: { label: "Orders", icon: <ShoppingCartOutlined /> },
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
                <Route path="/users">
                  <Route index element={<UserList />} />
                  <Route path="create" element={<UserCreate />} />
                  <Route path="edit/:id" element={<UserEdit />} />
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
                <Route path="/banners">
                  <Route index element={<BannerList />} />
                  <Route path="create" element={<BannerCreate />} />
                  <Route path="edit/:id" element={<BannerEdit />} />
                </Route>
                <Route path="/collections">
                  <Route index element={<CollectionList />} />
                  <Route path="create" element={<CollectionCreate />} />
                  <Route path="edit/:id" element={<CollectionEdit />} />
                </Route>
                <Route path="/coupons">
                  <Route index element={<CouponList />} />
                  <Route path="create" element={<CouponCreate />} />
                  <Route path="edit/:id" element={<CouponEdit />} />
                </Route>
                <Route path="/reviews" element={<ReviewList />} />
                <Route path="/notifications">
                  <Route path="dashboard" element={<NotificationDashboard />} />
                  <Route path="campaigns" element={<CampaignList />} />
                  <Route path="campaigns/show/:id" element={<CampaignShow />} />
                  <Route path="send" element={<NotificationSend />} />
                  <Route path="templates" element={<TemplateList />} />
                  <Route path="templates/create" element={<TemplateCreate />} />
                  <Route path="templates/edit/:id" element={<TemplateEdit />} />
                </Route>
                <Route path="/loyalty-settings" element={<LoyaltySettings />} />
                <Route path="/loyalty-customers" element={<LoyaltyCustomers />} />
                <Route path="/delivery-zones">
                  <Route index element={<DeliveryZoneList />} />
                  <Route path="create" element={<DeliveryZoneCreate />} />
                  <Route path="edit/:id" element={<DeliveryZoneEdit />} />
                </Route>
                <Route path="/delivery-tiers" element={<DeliveryTierList />} />
                <Route path="/delivery-slots" element={<DeliverySlotList />} />
                <Route path="/express-delivery" element={<ExpressDeliveryConfig />} />
                <Route path="/delivery-board" element={<DeliveryBoard />} />
                <Route path="/riders" element={<RidersList />} />
                <Route path="/stock" element={<StockPage />} />
                <Route path="/featured-products" element={<FeaturedProductsPage />} />
                <Route path="/" element={<DashboardPage />} />
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
