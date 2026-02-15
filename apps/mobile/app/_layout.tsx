import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../lib/auth-context";
import { CartProvider } from "../lib/cart-context";

export default function RootLayout() {
  return (
    <AuthProvider>
      <CartProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="store/[id]" options={{ headerShown: true, title: "Store" }} />
          <Stack.Screen name="checkout" options={{ headerShown: true, title: "Checkout" }} />
        </Stack>
      </CartProvider>
    </AuthProvider>
  );
}
