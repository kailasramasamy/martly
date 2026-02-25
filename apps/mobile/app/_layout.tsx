import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../lib/auth-context";
import { CartProvider } from "../lib/cart-context";
import { StoreProvider } from "../lib/store-context";
import { addNotificationResponseListener } from "../lib/notifications";

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    const subscription = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === "ORDER_STATUS_UPDATE" && data?.orderId) {
        router.push(`/order/${data.orderId}`);
      }
    });
    return () => subscription.remove();
  }, [router]);

  return (
    <AuthProvider>
      <StoreProvider>
        <CartProvider>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false, headerBackTitle: "Back" }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="store/[id]" options={{ headerShown: true, title: "Store" }} />
            <Stack.Screen name="product/[id]" options={{ headerShown: true, title: "Product" }} />
            <Stack.Screen name="category/[id]" options={{ headerShown: true, title: "Category" }} />
            <Stack.Screen name="search" options={{ headerShown: true, title: "Search" }} />
            <Stack.Screen name="checkout" options={{ headerShown: true, title: "Checkout" }} />
            <Stack.Screen name="order/[id]" options={{ headerShown: true, title: "Order Details" }} />
          </Stack>
        </CartProvider>
      </StoreProvider>
    </AuthProvider>
  );
}
