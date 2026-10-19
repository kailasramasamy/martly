import { useEffect, useState, useCallback, useRef } from "react";
import { Stack, useRouter, useSegments, type Href } from "expo-router";
import { ThemeProvider, DefaultTheme } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { View, Text, TextInput, StyleSheet, Appearance } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import { PlayfairDisplay_700Bold } from "@expo-google-fonts/playfair-display";
import { YatraOne_400Regular } from "@expo-google-fonts/yatra-one";
import { Kalam_700Bold } from "@expo-google-fonts/kalam";
import { Lobster_400Regular } from "@expo-google-fonts/lobster";

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
    primary: colors.primary,
  },
};
import * as ExpoSplashScreen from "expo-splash-screen";
import { AuthProvider, useAuth } from "../lib/auth-context";
import { PersonaProvider, usePersona } from "../lib/persona-context";
import { ManageScopeProvider } from "../lib/manage-scope-context";
import { TabBarVisibilityProvider } from "../lib/tab-bar-visibility";
import { CartProvider } from "../lib/cart-context";
import { StoreProvider } from "../lib/store-context";
import { WishlistProvider } from "../lib/wishlist-context";
import { ToastProvider } from "../lib/toast-context";
import { NotificationProvider } from "../lib/notification-context";
import { MembershipProvider } from "../lib/membership-context";
import { BasketModeProvider } from "../lib/basket-mode-context";
import { LanguageProvider } from "../lib/language-context";
import { addNotificationResponseListener, getLastNotificationResponse, notificationResponseData } from "../lib/notifications";
import { resolveNotificationDeepLink } from "../lib/notification-helpers";
import SplashScreen from "../components/SplashScreen";
import { colors } from "../constants/theme";
import { manage } from "../components/manage/ui/tokens";
import { SignInProvider } from "../lib/sign-in-context";

// Keep native splash visible until we're ready
ExpoSplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isLoading } = useAuth();
  const { home, canManage, isReady: personaReady } = usePersona();
  const insets = useSafeAreaInsets();
  const [appReady, setAppReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  // Stores a pending deep link from a notification tap that arrived before splash finished
  const pendingDeepLink = useRef<Href | null>(null);

  // On cold start, check if app was launched by tapping a notification
  useEffect(() => {
    getLastNotificationResponse().then((response) => {
      const data = notificationResponseData(response);
      if (data) pendingDeepLink.current = resolveNotificationDeepLink(data);
    });
  }, []);

  // The animated splash plays on every launch; hide the native one once auth resolves
  useEffect(() => {
    if (!isLoading && personaReady) {
      setAppReady(true);
      ExpoSplashScreen.hideAsync();
    }
  }, [isLoading, personaReady]);

  // Auth redirect: after splash done, react to auth state changes (login/logout)
  useEffect(() => {
    if (isLoading || !splashDone || !personaReady) return;

    const inAuth = segments[0] === "(auth)";
    const inManage = segments[0] === "(manage)" || segments[0] === "manage";
    const misplacedRole = home === "/unsupported-role" && segments[0] !== "unsupported-role";
    // A reload can land on the shop tabs while the member's persona is Manage
    const misplacedPersona = home === "/(manage)" && segments[0] === "(tabs)";

    // Guests shop freely; only the staff side needs an account
    if (!isAuthenticated && inManage) {
      router.replace("/(auth)/login");
    } else if (isAuthenticated && (inAuth || misplacedRole || misplacedPersona || (inManage && !canManage))) {
      router.replace(home);
    }
  }, [isAuthenticated, isLoading, segments, splashDone, personaReady, home, canManage]);

  // Deep link handler for push notifications while app is running
  useEffect(() => {
    const subscription = addNotificationResponseListener((response) => {
      const data = notificationResponseData(response);
      if (data) {
        const target = resolveNotificationDeepLink(data);
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
    router.replace(isAuthenticated ? home : "/(tabs)");
  }, [isAuthenticated, router, home]);

  // Called after splash fade-out completes — remove the overlay and navigate to deep link
  const handleSplashFinish = useCallback(() => {
    setSplashDone(true);
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
      <Stack
        screenOptions={({ route }) => {
          // Manage stack screens live in this root stack so iOS draws the native "< Back"; they set their own titles
          const isManage = route.name.startsWith("manage/");
          return {
            headerShown: isManage,
            headerBackTitle: "Back",
            headerShadowVisible: !isManage,
            headerTitleStyle: { fontFamily: "Manrope-SemiBold" },
            contentStyle: { backgroundColor: isManage ? manage.canvas : "#f8fafc" },
          };
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(manage)" />
        <Stack.Screen name="unsupported-role" options={{ gestureEnabled: false }} />
        <Stack.Screen name="delete-account" options={{ headerShown: true, title: "Delete Account" }} />
        <Stack.Screen name="store/[id]" options={{ headerShown: true, title: "Store" }} />
        <Stack.Screen name="choose-store" options={{ headerShown: true, title: "Choose a store" }} />
        <Stack.Screen name="product/[id]" options={{ headerShown: true, title: "Product" }} />
        <Stack.Screen name="category/[id]" options={{ headerShown: true, title: "Category" }} />
        <Stack.Screen name="brand/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="brands" options={{ headerShown: false }} />
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
        <Stack.Screen name="subscriptions" options={{ headerShown: true, title: "My Subscriptions" }} />
        <Stack.Screen name="subscription/[id]" options={{ headerShown: true, title: "Subscription" }} />
        <Stack.Screen name="tomorrows-basket" options={{ headerShown: true, title: "Tomorrow's Basket" }} />
        <Stack.Screen name="subscription-builder" options={{ headerShown: true, title: "New Subscription" }} />
        <Stack.Screen name="language-settings" options={{ headerShown: true, title: "Language" }} />
        <Stack.Screen name="recipes" options={{ headerShown: true, title: "Recipes" }} />
        <Stack.Screen name="recipe/[id]" options={{ headerShown: true, title: "Recipe" }} />
        <Stack.Screen name="festival/[id]" options={{ headerShown: true, title: "Festive picks" }} />
        <Stack.Screen name="collection/[id]" options={{ headerShown: true, title: "" }} />
        <Stack.Screen name="deals/[sectionId]" options={{ headerShown: true, title: "Deals" }} />
      </Stack>
      {!splashDone && <SplashScreen onBeforeFadeOut={handleBeforeFadeOut} onFinish={handleSplashFinish} />}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "Manrope-Regular": Manrope_400Regular,
    "Manrope-Medium": Manrope_500Medium,
    "Manrope-SemiBold": Manrope_600SemiBold,
    "Manrope-Bold": Manrope_700Bold,
    "Manrope-ExtraBold": Manrope_800ExtraBold,
    "PlayfairDisplay-Bold": PlayfairDisplay_700Bold,
    "YatraOne-Regular": YatraOne_400Regular,
    "Kalam-Bold": Kalam_700Bold,
    "Lobster-Regular": Lobster_400Regular,
  });

  if (!fontsLoaded) return null;

  // Set default font for Text/TextInput (regular weight — other weights handled by font-patch.ts)
  const defaultFont = { fontFamily: "Manrope-Regular" };
  (Text as any).defaultProps = (Text as any).defaultProps || {};
  (Text as any).defaultProps.style = [defaultFont];
  (TextInput as any).defaultProps = (TextInput as any).defaultProps || {};
  (TextInput as any).defaultProps.style = [defaultFont];

  return (
    <SafeAreaProvider>
      <ThemeProvider value={LightTheme}>
        <AuthProvider>
          <PersonaProvider>
          <ManageScopeProvider>
          <TabBarVisibilityProvider>
          <LanguageProvider>
          <StoreProvider>
            <MembershipProvider>
            <CartProvider>
              <BasketModeProvider>
              <ToastProvider>
              <WishlistProvider>
                <NotificationProvider>
                  <SignInProvider>
                    <RootLayoutNav />
                  </SignInProvider>
                </NotificationProvider>
              </WishlistProvider>
              </ToastProvider>
              </BasketModeProvider>
            </CartProvider>
            </MembershipProvider>
          </StoreProvider>
          </LanguageProvider>
          </TabBarVisibilityProvider>
          </ManageScopeProvider>
          </PersonaProvider>
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
