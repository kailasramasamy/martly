import { View, Text, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "../../constants/theme";
import { useCart } from "../../lib/cart-context";

type IconName = keyof typeof Ionicons.glyphMap;

const INACTIVE = "#94a3b8";

function TabIcon({ focused, icon, badge }: { focused: boolean; icon: IconName; badge?: number }) {
  const name = (focused ? icon : `${icon}-outline`) as IconName;
  return (
    <View style={[styles.pill, focused && styles.pillActive]}>
      <Ionicons name={name} size={22} color={focused ? colors.primary : INACTIVE} />
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? "9+" : badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function TabsLayout() {
  const { itemCount } = useCart();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 10);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: INACTIVE,
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: { ...styles.tabBar, height: 62 + bottomPadding, paddingBottom: bottomPadding },
        headerTitleStyle: styles.headerTitle,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", headerShown: false, tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="home" /> }}
      />
      <Tabs.Screen
        name="categories"
        options={{ title: "Categories", tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="grid" /> }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          tabBarAccessibilityLabel: itemCount > 0 ? `Cart, ${itemCount} items` : "Cart",
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="bag-handle" badge={itemCount} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{ title: "Orders", tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="receipt" /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Account", tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="person" /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#eef2f6",
    backgroundColor: "#fff",
    elevation: 0,
    shadowOpacity: 0,
  },
  tabLabel: { fontFamily: fonts.bold, fontSize: 11.5, marginTop: 6 },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  pill: { width: 60, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  pillActive: { backgroundColor: "#ccfbf1" },
  badge: {
    position: "absolute",
    top: -4,
    right: 8,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 4,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontFamily: fonts.extrabold, fontSize: 10.5, color: colors.accentText },
});
