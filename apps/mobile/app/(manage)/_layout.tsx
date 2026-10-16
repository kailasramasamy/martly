import { Tabs } from "expo-router";
import { TabIcon, TabSceneLayout, useTabBarOptions } from "../../components/TabIcon";
import { Permission } from "@martly/shared/constants";
import { can, hasPermission } from "@martly/shared/permissions";
import { useLiveOrders } from "../../lib/manage/use-live-orders";
import { useCountsWaiting, useCountsWaitingSync } from "../../lib/manage/use-counts-waiting";
import { useAuth } from "../../lib/auth-context";
import { useDispatchAccess } from "../../components/manage/delivery/use-dispatch-access";

export default function ManageTabsLayout() {
  const screenOptions = useTabBarOptions();
  const { user } = useAuth();
  const canSeeOrders = user?.role === "SUPER_ADMIN" || hasPermission(user?.permissions, Permission.ORDERS_VIEW);
  const { riderOnly } = useDispatchAccess();
  const canSeeDelivery = canSeeOrders || hasPermission(user?.permissions, Permission.DELIVERY_DELIVER);
  const canSeeToday = user?.role === "SUPER_ADMIN" || hasPermission(user?.permissions, Permission.REPORTS_VIEW);
  const canSeeInventory = can(user, "store-products", "list");
  const pendingOrders = useLiveOrders(canSeeOrders);
  useCountsWaitingSync();
  const countsWaiting = useCountsWaiting();

  return (
    <Tabs screenOptions={{ ...screenOptions, headerShown: false }} screenLayout={TabSceneLayout}>
      <Tabs.Screen name="index" options={{ title: "Today", href: canSeeToday ? undefined : null, tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="pulse" /> }} />
      <Tabs.Screen name="orders" options={{ title: "Orders", href: canSeeOrders ? undefined : null, tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="receipt" badge={pendingOrders} /> }} />
      <Tabs.Screen name="catalog" options={{ title: "Inventory", href: canSeeInventory ? undefined : null, tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="cube" /> }} />
      <Tabs.Screen name="delivery" options={{ title: riderOnly ? "Trips" : "Delivery", href: canSeeDelivery ? undefined : null, tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="bicycle" /> }} />
      <Tabs.Screen name="more" options={{ title: "More", tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="apps" badge={countsWaiting} /> }} />
    </Tabs>
  );
}
