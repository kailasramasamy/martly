import { Refine, Authenticated } from "@refinedev/core";
import { ThemedLayoutV2, useNotificationProvider } from "@refinedev/antd";
import routerProvider from "@refinedev/react-router";
import { BrowserRouter, Routes, Route, Outlet } from "react-router";
import { App as AntdApp, ConfigProvider } from "antd";
import {
  DashboardOutlined,
  BankOutlined,
  ShopOutlined,
  AppstoreOutlined,
  TagsOutlined,
  ShoppingOutlined,
  ShoppingCartOutlined,
} from "@ant-design/icons";

import "@refinedev/antd/dist/reset.css";

import { theme } from "./theme";
import { authProvider } from "./providers/auth-provider";
import { martlyDataProvider } from "./providers/data-provider";
import { LoginPage } from "./pages/login";
import { StoreList } from "./pages/stores/list";
import { StoreCreate } from "./pages/stores/create";
import { StoreEdit } from "./pages/stores/edit";
import { StoreShow } from "./pages/stores/show";
import { StoreOnboard } from "./pages/stores/onboard";
import { ProductList } from "./pages/products/list";
import { ProductCreate } from "./pages/products/create";
import { ProductEdit } from "./pages/products/edit";
import { ProductShow } from "./pages/products/show";
import { OrderList } from "./pages/orders/list";
import { OrderShow } from "./pages/orders/show";
import { OrganizationList } from "./pages/organizations/list";
import { OrganizationCreate } from "./pages/organizations/create";
import { OrganizationEdit } from "./pages/organizations/edit";
import { StoreProductList } from "./pages/store-products/list";
import { StoreProductCreate } from "./pages/store-products/create";
import { StoreProductEdit } from "./pages/store-products/edit";
import { DashboardPage } from "./pages/dashboard";
import { CategoryList } from "./pages/categories/list";
import { CategoryCreate } from "./pages/categories/create";
import { CategoryEdit } from "./pages/categories/edit";
import { CategoryTree } from "./pages/categories/tree";

export default function App() {
  return (
    <BrowserRouter>
      <ConfigProvider theme={theme}>
        <AntdApp>
          <Refine
            routerProvider={routerProvider}
            dataProvider={martlyDataProvider}
            authProvider={authProvider}
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
                name: "products",
                list: "/products",
                create: "/products/create",
                edit: "/products/edit/:id",
                show: "/products/show/:id",
                meta: { label: "Products", icon: <TagsOutlined /> },
              },
              {
                name: "store-products",
                list: "/store-products",
                create: "/store-products/create",
                edit: "/store-products/edit/:id",
                meta: { label: "Store Products", icon: <ShoppingOutlined /> },
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
                      Title={() => (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <ShopOutlined style={{ fontSize: 24, color: "#fff" }} />
                          <span style={{ fontSize: 20, fontWeight: "bold", color: "#fff" }}>Martly</span>
                        </div>
                      )}
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
                <Route path="/products">
                  <Route index element={<ProductList />} />
                  <Route path="create" element={<ProductCreate />} />
                  <Route path="edit/:id" element={<ProductEdit />} />
                  <Route path="show/:id" element={<ProductShow />} />
                </Route>
                <Route path="/store-products">
                  <Route index element={<StoreProductList />} />
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
            </Routes>
          </Refine>
        </AntdApp>
      </ConfigProvider>
    </BrowserRouter>
  );
}
