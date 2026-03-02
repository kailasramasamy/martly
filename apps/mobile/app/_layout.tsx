import { useEffect, useState, useCallback, useRef } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { ThemeProvider, DefaultTheme } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { View, Text, TextInput, StyleSheet, Appearance } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
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
import * as SecureStore from "expo-secure-store";
import { AuthProvider, useAuth } from "../lib/auth-context";
import { CartProvider } from "../lib/cart-context";
import { StoreProvider } from "../lib/store-context";
import { WishlistProvider } from "../lib/wishlist-context";
import { ToastProvider } from "../lib/toast-context";
import { NotificationProvider } from "../lib/notification-context";
import { addNotificationResponseListener, getLastNotificationResponse } from "../lib/notifications";
import { resolveNotificationDeepLink } from "../lib/notification-helpers";
import SplashScreen from "../components/SplashScreen";

// Keep native splash visible until we're ready
ExpoSplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const [appReady, setAppReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  // Stores a pending deep link from a notification tap that arrived before splash finished
  const pendingDeepLink = useRef<string | null>(null);

  // On cold start, check if app was launched by tapping a notification
  useEffect(() => {
    getLastNotificationResponse().then((response) => {
      if (response) {
        const data = response.notification.request.content.data;
        if (data) {
          pendingDeepLink.current = resolveNotificationDeepLink(data as Record<string, unknown>);
        }
      }
    });
  }, []);

  // When auth resolves, check if animated splash should be skipped (recent reload)
  useEffect(() => {
    if (!isLoading) {
      SecureStore.getItemAsync("splash_ts").then((ts) => {
        if (ts && Date.now() - Number(ts) < 5 * 60 * 1000) {
          // Splash played within 5 min — skip animated splash (notification-triggered reload)
          setSplashDone(true);
        }
        setAppReady(true);
        ExpoSplashScreen.hideAsync();
      }).catch(() => {
        setAppReady(true);
        ExpoSplashScreen.hideAsync();
      });
    }
  }, [isLoading]);

  // Auth redirect: after splash done, react to auth state changes (login/logout)
  useEffect(() => {
    if (isLoading || !splashDone) return;

    const inAuth = segments[0] === "(auth)";

    if (!isAuthenticated && !inAuth) {
      router.replace("/(auth)/login");
    } else if (isAuthenticated && inAuth) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isLoading, segments, splashDone]);

  // Deep link handler for push notifications while app is running
  useEffect(() => {
    const subscription = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      if (data) {
        const target = resolveNotificationDeepLink(data as Record<string, unknown>);
        if (splashDone) {
          router.push(target);
        } else {
          // Splash still showing — queue for after splash finishes
          pendingDeepLink.current = target;
        }
      }
    });
    return () => subscription.remove();
  }, [router, splashDone]);

  // Called while splash is still fully opaque — navigate to correct screen
  const handleBeforeFadeOut = useCallback(() => {
    if (isAuthenticated) {
      router.replace("/(tabs)");
    } else {
      router.replace("/(auth)/login");
    }
  }, [isAuthenticated, router]);

  // Called after splash fade-out completes — remove the overlay and navigate to deep link
  const handleSplashFinish = useCallback(() => {
    setSplashDone(true);
    SecureStore.setItemAsync("splash_ts", String(Date.now())).catch(() => {});
    // If a notification tap was queued during splash, navigate now
    if (pendingDeepLink.current && isAuthenticated) {
      const target = pendingDeepLink.current;
      pendingDeepLink.current = null;
      // Small delay to let the root screen settle before pushing
      setTimeout(() => router.push(target), 100);
    }
  }, [isAuthenticated, router]);

  // While auth is loading, show nothing (native splash is still visible)
  if (!appReady) {
    return null;
  }

  return (
    <>
      <StatusBar style="dark" translucent={false} backgroundColor="#ffffff" />
      <Stack screenOptions={{ headerShown: false, headerBackTitle: "Back", headerTitleStyle: { fontFamily: "Inter-SemiBold" }, contentStyle: { backgroundColor: "#f8fafc" } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
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
        <Stack.Screen name="referral" options={{ headerShown: true, title: "Refer & Earn" }} />
        <Stack.Screen name="ai-order" options={{ headerShown: false }} />
        <Stack.Screen name="support-chat" options={{ headerShown: false }} />
        <Stack.Screen name="support-tickets" options={{ headerShown: true, title: "My Tickets" }} />
        <Stack.Screen name="support-ticket/[id]" options={{ headerShown: true, title: "Ticket Details" }} />
        <Stack.Screen name="smart-reorder" options={{ headerShown: true, title: "Smart Reorder" }} />
        <Stack.Screen name="return-request" options={{ headerShown: true, title: "Request Return" }} />
        <Stack.Screen name="live-tracking" options={{ headerShown: true, title: "Live Tracking" }} />
        <Stack.Screen name="order-success/[id]" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="membership" options={{ headerShown: true, title: "Mart Plus" }} />
      </Stack>
      {!splashDone && <SplashScreen onBeforeFadeOut={handleBeforeFadeOut} onFinish={handleSplashFinish} />}
    </>
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
    <SafeAreaProvider>
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
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
});
