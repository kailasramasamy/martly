import { useState, type ReactNode } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useNotifications } from "../../lib/notification-context";
import { useManageScope } from "../../lib/manage-scope-context";
import { manage } from "./ui/tokens";
import { StoreSwitcherSheet } from "./StoreSwitcherSheet";

interface ManageHeaderProps {
  title: string;
  /** One line under the title, e.g. what the screen covers */
  subtitle?: string;
  /** Extra content inside the ink band, e.g. the Today KPI strip */
  children?: ReactNode;
  right?: ReactNode;
  /** Scrolled: title folds into the top row and the subtitle/extra content hide */
  collapsed?: boolean;
}

/** Ink "command bar" shared by every Manage tab: screen title + store scope switcher */
export function ManageHeader({ title, subtitle, children, right, collapsed }: ManageHeaderProps) {
  const insets = useSafeAreaInsets();
  const { store, storeId, stores, allowAllStores } = useManageScope();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const { staffUnreadCount } = useNotifications();
  const isFocused = useIsFocused();
  const canSwitch = stores.length > 1 || (allowAllStores && stores.length > 0);
  const scopeLabel = storeId === null ? "All stores" : store?.name ?? "Select store";

  return (
    <View style={[styles.band, collapsed && styles.bandCollapsed, { paddingTop: insets.top + 8 }]}>
      {isFocused && <StatusBar style="light" />}
      <View style={styles.row}>
        {collapsed && <Text style={styles.titleCompact} numberOfLines={1} accessibilityRole="header">{title}</Text>}
        <TouchableOpacity
          style={[styles.scope, collapsed && styles.scopeCompact]}
          onPress={() => setSwitcherOpen(true)}
          disabled={!canSwitch}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Store: ${scopeLabel}. Change store`}
        >
          <View style={styles.liveDot} />
          <Text style={styles.scopeText} numberOfLines={1}>{scopeLabel}</Text>
          {canSwitch && <Ionicons name="chevron-down" size={14} color={manage.inkMuted} />}
        </TouchableOpacity>
        <View style={styles.actions}>
          {right}
          <TouchableOpacity
            style={styles.bell}
            onPress={() => router.push({ pathname: "/notifications", params: { audience: "staff" } })}
            accessibilityRole="button"
            accessibilityLabel={staffUnreadCount > 0 ? `Alerts, ${staffUnreadCount} unread` : "Alerts"}
          >
            <Ionicons name="notifications-outline" size={22} color={manage.inkText} />
            {staffUnreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{staffUnreadCount > 99 ? "99+" : staffUnreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
      {!collapsed && <Text style={styles.title} accessibilityRole="header">{title}</Text>}
      {!collapsed && subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      {!collapsed && children}
      <StoreSwitcherSheet visible={switcherOpen} onClose={() => setSwitcherOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  band: { backgroundColor: manage.ink, paddingHorizontal: 16, paddingBottom: 12 },
  bandCollapsed: { paddingBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: 44 },
  actions: { flexDirection: "row", alignItems: "center", gap: 4 },
  bell: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  bellBadge: {
    position: "absolute", top: 4, right: 2, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 3,
  },
  bellBadgeText: { fontFamily: fonts.bold, fontSize: 9, color: "#fff" },
  titleCompact: { flex: 1, fontFamily: fonts.extrabold, fontSize: 18, color: "#fff", letterSpacing: -0.3 },
  scopeCompact: { maxWidth: "55%" },
  scope: {
    flexDirection: "row", alignItems: "center", gap: 7, maxWidth: "75%",
    height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: manage.inkRaised,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: manage.live },
  scopeText: { fontFamily: fonts.bold, fontSize: 13, color: manage.inkText, flexShrink: 1 },
  title: { fontFamily: fonts.extrabold, fontSize: 26, color: "#fff", letterSpacing: -0.6, marginTop: 6 },
  subtitle: { fontFamily: fonts.semibold, fontSize: 13.5, color: manage.inkMuted, marginTop: 4 },
});
