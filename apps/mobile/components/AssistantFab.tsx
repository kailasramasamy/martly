import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Animated, StyleSheet } from "react-native";
import { router, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../constants/theme";
import { useStrings } from "../lib/i18n/use-strings";

const ACTIONS: { key: "aiOrder" | "support" | "reorder"; icon: keyof typeof Ionicons.glyphMap; href: Href }[] = [
  { key: "aiOrder", icon: "sparkles", href: "/ai-order" },
  { key: "support", icon: "headset", href: "/support-chat" },
  { key: "reorder", icon: "refresh-circle", href: "/smart-reorder" },
];

const LABEL_WIDTH = 82;

type Action = (typeof ACTIONS)[number];

function ActionItem({ action, index, menu, open, onPress }: {
  action: Action; index: number; menu: Animated.Value; open: boolean; onPress: (href: Href) => void;
}) {
  const t = useStrings("subscriptions");
  const translateY = menu.interpolate({ inputRange: [0, 1], outputRange: [0, -72 - index * 60] });
  return (
    <Animated.View
      style={[styles.actionWrap, { opacity: menu, transform: [{ translateY }] }]}
      pointerEvents={open ? "auto" : "none"}
    >
      <Pressable style={styles.actionRow} onPress={() => onPress(action.href)} accessibilityRole="button">
        <View style={styles.actionLabel}>
          <Text style={styles.actionLabelText}>{t.fab[action.key]}</Text>
        </View>
        <View style={styles.actionBtn}>
          <Ionicons name={action.icon} size={20} color="#fff" />
        </View>
      </Pressable>
    </Animated.View>
  );
}

interface Props {
  // Collapse to an icon-only button (e.g. while the user scrolls) so it covers less content
  compact: boolean;
}

export function AssistantFab({ compact }: Props) {
  const t = useStrings("subscriptions");
  const [open, setOpen] = useState(false);
  const menu = useRef(new Animated.Value(0)).current;
  const label = useRef(new Animated.Value(compact ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(label, { toValue: compact && !open ? 0 : 1, duration: 180, useNativeDriver: false }).start();
  }, [compact, open, label]);

  const toggle = useCallback(() => {
    Animated.spring(menu, { toValue: open ? 0 : 1, useNativeDriver: true, friction: 6, tension: 80 }).start();
    setOpen(!open);
  }, [open, menu]);

  const go = (href: Href) => {
    toggle();
    router.push(href);
  };

  const rotate = menu.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "90deg"] });
  const labelWidth = label.interpolate({ inputRange: [0, 1], outputRange: [0, LABEL_WIDTH] });

  return (
    <>
      {open && (
        <Animated.View style={[styles.overlay, { opacity: menu }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={toggle} accessibilityLabel={t.fab.closeMenu} />
        </Animated.View>
      )}

      {ACTIONS.map((action, i) => (
        <ActionItem key={action.key} action={action} index={i} menu={menu} open={open} onPress={go} />
      ))}

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.9 }]}
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={open ? t.fab.closeMenu : t.fab.openMenu}
      >
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Ionicons name={open ? "close" : "sparkles"} size={22} color="#fff" />
        </Animated.View>
        <Animated.View style={{ width: labelWidth, overflow: "hidden", opacity: label }}>
          <Text style={styles.fabLabel} numberOfLines={1}>{t.fab.assistant}</Text>
        </Animated.View>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,23,42,0.3)", zIndex: 99 },
  fab: {
    position: "absolute", bottom: 20, right: 16, zIndex: 101,
    flexDirection: "row", alignItems: "center",
    height: 52, paddingHorizontal: 15, borderRadius: 26,
    backgroundColor: colors.primary,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  fabLabel: { fontFamily: fonts.bold, fontSize: 14, color: "#fff", marginLeft: 8 },
  actionWrap: { position: "absolute", bottom: 20, right: 20, zIndex: 100, alignItems: "flex-end" },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  actionLabel: {
    backgroundColor: "#fff", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  actionLabelText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  actionBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
  },
});
