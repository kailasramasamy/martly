import { createContext, useContext, useCallback, useRef, useState } from "react";
import { Animated, View, Text, TouchableOpacity, StyleSheet, Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

type ToastVariant = "default" | "info" | "success" | "error";

/** A button on the toast, e.g. Undo; the toast stays a little longer so there's time to tap one */
interface ToastAction {
  label: string;
  onPress: () => void;
}

interface ToastContextType {
  show: (message: string, variant?: ToastVariant, actions?: ToastAction[]) => void;
  /** Height of a bar docked above the tab bar on the screen in view (e.g. checkout), so toasts sit above it */
  setDockHeight: (height: number) => void;
}

const ACTION_VISIBLE_MS = 4500;

const ToastContext = createContext<ToastContextType>({ show: () => {}, setDockHeight: () => {} });

const SIDE_MARGIN = 16;
const MAX_CARD_WIDTH = 440;

// Long enough to read: a base, more for longer text, and errors linger a little longer
function visibleFor(message: string, variant: ToastVariant) {
  const base = variant === "error" ? 3000 : 2200;
  return Math.min(6000, base + message.length * 30);
}

const VARIANT_CONFIG: Record<ToastVariant, { bg: string; icon: keyof typeof Ionicons.glyphMap; iconColor: string }> = {
  default: { bg: "#1e293b", icon: "information-circle", iconColor: "#94a3b8" },
  info: { bg: "#1e3a8a", icon: "information-circle", iconColor: "#93c5fd" },
  success: { bg: "#065f46", icon: "checkmark-circle", iconColor: "#6ee7b7" },
  error: { bg: "#7f1d1d", icon: "alert-circle", iconColor: "#fca5a5" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [dockHeight, setDockHeight] = useState(0);
  const [, forceRender] = useState(0);
  const messageRef = useRef("");
  const variantRef = useRef<ToastVariant>("default");
  const actionsRef = useRef<ToastAction[]>([]);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastShowTime = useRef(0);

  const hide = useCallback(() => {
    actionsRef.current = [];
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 20, duration: 300, useNativeDriver: true }),
    ]).start(() => forceRender((n) => n + 1));
  }, [opacity, translateY]);

  const show = useCallback((msg: string, v: ToastVariant = "default", actions: ToastAction[] = []) => {
    const now = Date.now();
    const elapsed = now - lastShowTime.current;
    lastShowTime.current = now;

    // Update content
    messageRef.current = msg;
    variantRef.current = v;
    actionsRef.current = actions;

    // Reset hide timer
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(hide, actions.length > 0 ? Math.max(ACTION_VISIBLE_MS, visibleFor(msg, v)) : visibleFor(msg, v));

    if (elapsed < 500) {
      // Toast already visible — just swap content, no animation
      forceRender((n) => n + 1);
      return;
    }

    // Fresh toast — animate in
    opacity.stopAnimation();
    translateY.stopAnimation();
    opacity.setValue(0);
    translateY.setValue(20);
    forceRender((n) => n + 1);

    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  }, [opacity, translateY, hide]);

  const config = VARIANT_CONFIG[variantRef.current];
  const actions = actionsRef.current;
  const runAction = (action: ToastAction) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    action.onPress();
    hide();
  };

  return (
    <ToastContext.Provider value={{ show, setDockHeight }}>
      {children}
      <Animated.View
        pointerEvents={actions.length > 0 ? "box-none" : "none"}
        style={[styles.wrapper, { bottom: insets.bottom + 72 + dockHeight, opacity, transform: [{ translateY }] }]}
      >
        <View
          style={[styles.card, { backgroundColor: config.bg, maxWidth: Math.min(MAX_CARD_WIDTH, windowWidth - SIDE_MARGIN * 2) }]}
          accessibilityLiveRegion="polite"
        >
          <Ionicons name={config.icon} size={18} color={config.iconColor} style={styles.icon} />
          <Text style={styles.text}>{messageRef.current}</Text>
          {actions.map((action) => (
            <TouchableOpacity key={action.label} onPress={() => runAction(action)} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }} accessibilityRole="button">
              <Text style={styles.action}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  // One standard for every toast: a centred card with side margins, never edge to edge, wrapping long text cleanly
  wrapper: {
    position: "absolute",
    left: SIDE_MARGIN,
    right: SIDE_MARGIN,
    alignItems: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },
  icon: { marginTop: 0.5 },
  action: { color: "#fbbf24", fontSize: 13.5, lineHeight: 19, fontWeight: "800", marginLeft: 6 },
  text: {
    flexShrink: 1,
    color: "#fff",
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: "600",
  },
});
