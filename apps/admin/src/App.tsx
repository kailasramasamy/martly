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
} from "@ant-design/icons";

import "@refinedev/antd/dist/reset.css";

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
                name: "stores",
                list: "/stores",
                create: "/stores/create",
                edit: "/stores/edit/:id",
                show: "/stores/show/:id",
                meta: { label: "Stores", icon: <ShopOutlined /> },
              },
              {
                name: "categories",
                list: "/categories",
                create: "/categories/create",
                edit: "/categories/edit/:id",
                meta: { label: "Categories", icon: <AppstoreOutlined /> },
              },
              {
                name: "brands",
                list: "/brands",
                create: "/brands/create",
                edit: "/brands/edit/:id",
                meta: { label: "Brands", icon: <TrademarkOutlined /> },
              },
              {
                name: "products",
                list: "/products",
                create: "/products/create",
                edit: "/products/edit/:id",
                show: "/products/show/:id",
                meta: { label: "Products", icon: <TagsOutlined /> },
              },
              {
                name: "store-products",
                create: "/store-products/create",
                edit: "/store-products/edit/:id",
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
