import { Pressable, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";
import type { Store } from "../../lib/types";
import { useStoreBranding } from "./branding";

interface ChooseStoreButtonProps {
  store: Store;
  /** Already shopping here */
  current?: boolean;
  /** Why this store can't be chosen; the button is shown disabled with this text */
  blockedReason?: string | null;
  onChoose: (store: Store) => void;
}

/** Commits the previewed store, in its brand colour */
export function ChooseStoreButton({ store, current, blockedReason, onChoose }: ChooseStoreButtonProps) {
  const brand = useStoreBranding(store);
  const t = useStrings("home");
  if (blockedReason) {
    return (
      <Pressable style={[styles.button, styles.blocked]} disabled accessibilityState={{ disabled: true }}>
        <Text style={[styles.label, styles.blockedLabel]} numberOfLines={1}>{blockedReason}</Text>
      </Pressable>
    );
  }
  const label = current ? t.shoppingAt(brand.name) : t.shopAt(brand.name);
  return (
    <Pressable
      style={({ pressed }) => [styles.button, { backgroundColor: brand.color }, pressed && styles.pressed]}
      onPress={() => onChoose(store)}
      accessibilityRole="button"
    >
      <Text style={[styles.label, { color: brand.onColor }]} numberOfLines={1}>{label}</Text>
      <Ionicons name={current ? "checkmark" : "arrow-forward"} size={18} color={brand.onColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 52, borderRadius: 14, paddingHorizontal: 18 },
  pressed: { opacity: 0.88 },
  label: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 16 },
  blocked: { backgroundColor: "#e2e8f0" },
  blockedLabel: { color: colors.textSecondary },
});
