import { Tabs } from "expo-router";
import { colors } from "../../constants/theme";
import { useCart } from "../../lib/cart-context";

export default function TabsLayout() {
  const { itemCount } = useCart();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          tabBarBadge: itemCount > 0 ? itemCount : undefined,
        }}
      />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
