import { Refine, Authenticated } from "@refinedev/core";
import { ThemedLayoutV2, useNotificationProvider } from "@refinedev/antd";
import routerProvider from "@refinedev/react-router";
import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router";
import { App as AntdApp } from "antd";

import "@refinedev/antd/dist/reset.css";

import { authProvider } from "./providers/auth-provider";
import { martlyDataProvider } from "./providers/data-provider";
import { LoginPage } from "./pages/login";
import { StoreList } from "./pages/stores/list";
import { StoreCreate } from "./pages/stores/create";
import { StoreEdit } from "./pages/stores/edit";
import { StoreShow } from "./pages/stores/show";
import { ProductList } from "./pages/products/list";
import { ProductCreate } from "./pages/products/create";
import { ProductEdit } from "./pages/products/edit";
import { ProductShow } from "./pages/products/show";
import { OrderList } from "./pages/orders/list";
import { OrderShow } from "./pages/orders/show";
import { StoreProductList } from "./pages/store-products/list";
import { StoreProductCreate } from "./pages/store-products/create";
import { StoreProductEdit } from "./pages/store-products/edit";

export default function App() {
  return (
    <BrowserRouter>
      <AntdApp>
        <Refine
          routerProvider={routerProvider}
          dataProvider={martlyDataProvider}
          authProvider={authProvider}
          notificationProvider={useNotificationProvider}
          resources={[
            {
              name: "stores",
              list: "/stores",
              create: "/stores/create",
              edit: "/stores/edit/:id",
              show: "/stores/show/:id",
              meta: { label: "Stores" },
            },
            {
              name: "products",
              list: "/products",
              create: "/products/create",
              edit: "/products/edit/:id",
              show: "/products/show/:id",
              meta: { label: "Products" },
            },
            {
              name: "store-products",
              list: "/store-products",
              create: "/store-products/create",
              edit: "/store-products/edit/:id",
              meta: { label: "Store Products" },
            },
            {
              name: "orders",
              list: "/orders",
              show: "/orders/show/:id",
              meta: { label: "Orders" },
            },
          ]}
        >
          <Routes>
            <Route
              element={
                <Authenticated key="auth" redirectOnFail="/login">
                  <ThemedLayoutV2 Title={() => <span style={{ fontSize: 20, fontWeight: "bold" }}>Martly Admin</span>}>
                    <Outlet />
                  </ThemedLayoutV2>
                </Authenticated>
              }
            >
              <Route path="/stores">
                <Route index element={<StoreList />} />
                <Route path="create" element={<StoreCreate />} />
                <Route path="edit/:id" element={<StoreEdit />} />
                <Route path="show/:id" element={<StoreShow />} />
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
              <Route path="/" element={<Navigate to="/stores" replace />} />
            </Route>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </Refine>
      </AntdApp>
    </BrowserRouter>
  );
}
