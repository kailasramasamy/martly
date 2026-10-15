import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../constants/theme";
import { useNotifications } from "../../lib/notification-context";
import { HomeHeaderLocation } from "../HomeHeaderLocation";
import { SearchBarButton } from "../SearchBarButton";
import type { Store } from "../../lib/types";

interface Props {
  store: Store | null;
  userArea: string | null;
  onPickStore: () => void;
  /** Festive wash colour; the header takes it on so the hero's ornament hangs straight off it */
  tint: string | null;
  /** Scrolled: the location row folds away and only the search bar stays pinned (Zepto-style) */
  collapsed?: boolean;
}

export function HomeHeader({ store, userArea, onPickStore, tint, collapsed }: Props) {
  const insets = useSafeAreaInsets();
  const { unreadCount } = useNotifications();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }, tint ? { backgroundColor: tint, borderBottomWidth: 0 } : null]}>
      {!collapsed && (
      <View style={styles.headerRow}>
        <HomeHeaderLocation store={store} userArea={userArea} onPress={onPickStore} />
        <TouchableOpacity
          style={[styles.iconBtn, tint ? styles.onTint : null]}
          onPress={() => router.push("/notifications")}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
        >
          <Ionicons name="notifications-outline" size={20} color={colors.text} />
          {unreadCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      )}
      <SearchBarButton onTint={Boolean(tint)} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 },
  iconBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center" },
  onTint: { backgroundColor: "rgba(255,255,255,0.85)" },
  bellBadge: {
    position: "absolute", top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: "#ef4444", justifyContent: "center", alignItems: "center", paddingHorizontal: 3,
  },
  bellBadgeText: { fontSize: 9, fontWeight: "700", color: "#fff" },
});
