import { useEffect, useState, useCallback } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { ThemeProvider, DefaultTheme } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { View, Text, TextInput, StyleSheet, Appearance } from "react-native";
import { useFonts } from "expo-font";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";

// Force light mode globally regardless of system setting
try { Appearance.setColorScheme("light"); } catch {}

const LightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#f8fafc",
    card: "#ffffff",
    text: "#0f172a",
    border: "#e2e8f0",
    primary: "#0d9488",
  },
};
import * as ExpoSplashScreen from "expo-splash-screen";
import { AuthProvider, useAuth } from "../lib/auth-context";
import { CartProvider } from "../lib/cart-context";
import { StoreProvider } from "../lib/store-context";
import { WishlistProvider } from "../lib/wishlist-context";
import { ToastProvider } from "../lib/toast-context";
import { NotificationProvider } from "../lib/notification-context";
import { addNotificationResponseListener } from "../lib/notifications";
import { resolveNotificationDeepLink } from "../lib/notification-helpers";
import SplashScreen from "../components/SplashScreen";

// Keep native splash visible until we're ready
ExpoSplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isLoading } = useAuth();
  const [appReady, setAppReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  // When auth resolves, hide native splash and show animated splash
  useEffect(() => {
    if (!isLoading) {
      setAppReady(true);
      ExpoSplashScreen.hideAsync();
    }
  }, [isLoading]);

  // Auth redirect: force login if not authenticated
  useEffect(() => {
    if (isLoading || !splashDone) return;

    const inAuth = segments[0] === "(auth)";

    if (!isAuthenticated && !inAuth) {
      router.replace("/(auth)/login");
    } else if (isAuthenticated && inAuth) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isLoading, segments, splashDone]);

  // Deep link handler for push notifications
  useEffect(() => {
    const subscription = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      if (data) {
        const target = resolveNotificationDeepLink(data as Record<string, unknown>);
        router.push(target);
      }
    });
    return () => subscription.remove();
  }, [router]);

  const handleSplashFinish = useCallback(() => {
    setSplashDone(true);
  }, []);

  // While auth is loading, show nothing (native splash is still visible)
  if (!appReady) {
    return null;
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, headerBackTitle: "Back", headerTitleStyle: { fontFamily: "Inter-SemiBold" }, contentStyle: { backgroundColor: "#f8fafc" } }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="store/[id]" options={{ headerShown: true, title: "Store" }} />
        <Stack.Screen name="product/[id]" options={{ headerShown: true, title: "Product" }} />
        <Stack.Screen name="category/[id]" options={{ headerShown: true, title: "Category" }} />
        <Stack.Screen name="search" options={{ headerShown: true, title: "Search" }} />
        <Stack.Screen name="checkout" options={{ headerShown: true, title: "Checkout" }} />
        <Stack.Screen name="order/[id]" options={{ headerShown: true, title: "Order Details" }} />
        <Stack.Screen name="wishlist" options={{ headerShown: true, title: "My Wishlist" }} />
        <Stack.Screen name="write-review" options={{ headerShown: true, title: "Write Review" }} />
        <Stack.Screen name="wallet" options={{ headerShown: true, title: "Martly Wallet" }} />
        <Stack.Screen name="loyalty" options={{ headerShown: true, title: "Loyalty Points" }} />
        <Stack.Screen name="notifications" options={{ headerShown: true, title: "Notifications" }} />
        <Stack.Screen name="order-success/[id]" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack>
      {!splashDone && <SplashScreen onFinish={handleSplashFinish} />}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "Inter-Regular": Inter_400Regular,
    "Inter-Medium": Inter_500Medium,
    "Inter-SemiBold": Inter_600SemiBold,
    "Inter-Bold": Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      const defaultTextStyle = { fontFamily: "Inter-Regular" };
      (Text as any).defaultProps = (Text as any).defaultProps || {};
      (Text as any).defaultProps.style = [defaultTextStyle, (Text as any).defaultProps.style];
      (TextInput as any).defaultProps = (TextInput as any).defaultProps || {};
      (TextInput as any).defaultProps.style = [defaultTextStyle, (TextInput as any).defaultProps.style];
    }
  }, [fontsLoaded]);

  return (
    <ThemeProvider value={LightTheme}>
      <AuthProvider>
        <StoreProvider>
          <CartProvider>
            <ToastProvider>
            <WishlistProvider>
              <NotificationProvider>
                <RootLayoutNav />
              </NotificationProvider>
            </WishlistProvider>
            </ToastProvider>
          </CartProvider>
        </StoreProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
});
