import { createContext, useContext, useCallback, useRef, useState } from "react";
import { Animated, View, Text, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

type ToastVariant = "default" | "success" | "error";

interface ToastContextType {
  show: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextType>({ show: () => {} });

const VARIANT_CONFIG: Record<ToastVariant, { bg: string; icon: keyof typeof Ionicons.glyphMap; iconColor: string }> = {
  default: { bg: "#1e293b", icon: "information-circle", iconColor: "#94a3b8" },
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
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
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
    }, 2000);

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
        <View style={[styles.pill, { backgroundColor: config.bg }]}>
          <Ionicons name={config.icon} size={16} color={config.iconColor} />
          <Text style={styles.text}>{messageRef.current}</Text>
        </View>
      </Animated.View>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 50,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },
  text: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
});
