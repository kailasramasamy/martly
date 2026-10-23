import { useEffect, useRef, useState, type ReactNode } from "react";
import { Modal, View, Text, Pressable, Animated, StyleSheet, Dimensions, TouchableOpacity, KeyboardAvoidingView, Platform, Keyboard, ScrollView, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing } from "../../constants/theme";
import { useKeyboardReveal } from "../../lib/use-keyboard-reveal";
import { useStrings } from "../../lib/i18n/use-strings";

const SCREEN_HEIGHT = Dimensions.get("window").height;
// Room kept between the sheet and the status bar
const TOP_GAP = 12;

/** iOS keyboard height while it's up; Android resizes the window itself, so it stays 0 there */
function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const show = Keyboard.addListener("keyboardWillShow", (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardWillHide", () => setHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return height;
}

interface BottomSheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Edge-to-edge content for lists whose rows pad themselves; forms get the standard inset */
  flush?: boolean;
  /** Scrolls the body and brings the focused input above the keyboard; use for forms, not for lists */
  scrollable?: boolean;
  /** A centred title with more room around it, for showcase sheets rather than forms and lists */
  centeredTitle?: boolean;
}

export function BottomSheet({ visible, title, onClose, children, footer, flush, scrollable, centeredTitle }: BottomSheetProps) {
  const common = useStrings("common");
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const keyboard = useKeyboardHeight();
  const reveal = useKeyboardReveal();
  // Never taller than the space between the status bar and the keyboard, so the header can't slide under the clock
  const maxHeight = Math.min(windowHeight * 0.8, windowHeight - keyboard - insets.top - TOP_GAP);
  const [mounted, setMounted] = useState(visible);
  const backdrop = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) setMounted(true);
    const toValue = visible ? 1 : 0;
    Animated.parallel([
      Animated.timing(backdrop, { toValue, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: visible ? 0 : SCREEN_HEIGHT, duration: 240, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, backdrop, translateY]);

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={common.close} />
        </Animated.View>
        <Animated.View style={[styles.sheet, { maxHeight, paddingBottom: Math.max(insets.bottom, spacing.md), transform: [{ translateY }] }]}>
          <View style={[styles.header, centeredTitle && styles.headerCentered]}>
            <Text style={[styles.title, centeredTitle && styles.titleCentered]}>{title}</Text>
            <TouchableOpacity style={[styles.closeBtn, centeredTitle && styles.closeCentered]} onPress={onClose} accessibilityLabel={common.close}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={[styles.body, !flush && styles.inset]}>
            {scrollable ? (
              <ScrollView keyboardDismissMode="on-drag" ref={reveal.scrollRef} onScroll={reveal.onScroll} scrollEventThrottle={16} keyboardShouldPersistTaps="handled">
                {children}
              </ScrollView>
            ) : children}
          </View>
          {footer ? <View style={!flush && styles.footer}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: spacing.md, paddingTop: spacing.sm },
  title: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  closeBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerCentered: { justifyContent: "center", paddingHorizontal: 52, paddingTop: spacing.lg, paddingBottom: spacing.md },
  titleCentered: { textAlign: "center" },
  // Level with the centred title's middle line
  closeCentered: { position: "absolute", right: spacing.xs, top: spacing.lg - 11 },
  body: { flexShrink: 1 },
  inset: { paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  footer: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
});
