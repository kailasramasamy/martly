import { Tabs } from "expo-router";
import { TabIcon, TabSceneLayout, useTabBarOptions } from "../../components/TabIcon";
import { useLiveOrders } from "../../lib/manage/use-live-orders";

export default function ManageTabsLayout() {
  const screenOptions = useTabBarOptions();
  const pendingOrders = useLiveOrders();

  return (
    <Tabs screenOptions={{ ...screenOptions, headerShown: false }} screenLayout={TabSceneLayout}>
      <Tabs.Screen name="index" options={{ title: "Today", tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="pulse" /> }} />
      <Tabs.Screen name="orders" options={{ title: "Orders", tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="receipt" badge={pendingOrders} /> }} />
      <Tabs.Screen name="catalog" options={{ title: "Inventory", tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="cube" /> }} />
      <Tabs.Screen name="delivery" options={{ title: "Delivery", tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="bicycle" /> }} />
      <Tabs.Screen name="more" options={{ title: "More", tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="apps" /> }} />
    </Tabs>
  );
}
