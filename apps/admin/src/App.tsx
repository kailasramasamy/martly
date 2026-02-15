import { Refine } from "@refinedev/core";
import { ThemedLayoutV2, useNotificationProvider } from "@refinedev/antd";
import routerProvider from "@refinedev/react-router";
import { BrowserRouter, Routes, Route, Outlet } from "react-router";
import { App as AntdApp } from "antd";

import "@refinedev/antd/dist/reset.css";

import { authProvider } from "./providers/auth-provider";
import { martlyDataProvider } from "./providers/data-provider";
import { StoreList } from "./pages/stores/list";
import { ProductList } from "./pages/products/list";
import { OrderList } from "./pages/orders/list";

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
              meta: { label: "Stores" },
            },
            {
              name: "products",
              list: "/products",
              meta: { label: "Products" },
            },
            {
              name: "orders",
              list: "/orders",
              meta: { label: "Orders" },
            },
          ]}
        >
          <Routes>
            <Route
              element={
                <ThemedLayoutV2 Title={() => <span style={{ fontSize: 20, fontWeight: "bold" }}>Martly Admin</span>}>
                  <Outlet />
                </ThemedLayoutV2>
              }
            >
              <Route path="/stores" element={<StoreList />} />
              <Route path="/products" element={<ProductList />} />
              <Route path="/orders" element={<OrderList />} />
              <Route path="/" element={<StoreList />} />
            </Route>
          </Routes>
        </Refine>
      </AntdApp>
    </BrowserRouter>
  );
}
