import { Tabs } from "expo-router";
import { useCart } from "../../lib/cart-context";
import { TabIcon, TabSceneLayout, useTabBarOptions } from "../../components/TabIcon";

export default function TabsLayout() {
  const { itemCount } = useCart();
  const screenOptions = useTabBarOptions();

  return (
    <Tabs screenOptions={screenOptions} screenLayout={TabSceneLayout}>
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
