import { createContext, useContext, useCallback, useRef, useState } from "react";
import { Animated, View, Text, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

type ToastVariant = "default" | "info" | "success" | "error";

interface ToastContextType {
  show: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextType>({ show: () => {} });

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
  const [, forceRender] = useState(0);
  const messageRef = useRef("");
  const variantRef = useRef<ToastVariant>("default");
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastShowTime = useRef(0);

  const show = useCallback((msg: string, v: ToastVariant = "default") => {
    const now = Date.now();
    const elapsed = now - lastShowTime.current;
    lastShowTime.current = now;

    // Update content
    messageRef.current = msg;
    variantRef.current = v;

    // Reset hide timer
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 20, duration: 300, useNativeDriver: true }),
      ]).start();
    }, visibleFor(msg, v));

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
  }, [opacity, translateY]);

  const config = VARIANT_CONFIG[variantRef.current];

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[styles.wrapper, { bottom: insets.bottom + 72, opacity, transform: [{ translateY }] }]}
      >
        <View style={[styles.card, { backgroundColor: config.bg }]} accessibilityLiveRegion="polite">
          <Ionicons name={config.icon} size={18} color={config.iconColor} style={styles.icon} />
          <Text style={styles.text}>{messageRef.current}</Text>
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
    left: 16,
    right: 16,
    alignItems: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    maxWidth: 440,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },
  icon: { marginTop: 0.5 },
  text: {
    flexShrink: 1,
    color: "#fff",
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: "600",
  },
});
