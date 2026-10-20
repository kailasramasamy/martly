import { Linking, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";
import { useLanguage } from "../../lib/language-context";
import type { Store } from "../../lib/types";

/** Opens Google Maps (the app when installed) with driving directions to the store */
export function DirectionsButton({ store }: { store: Store }) {
  const t = useStrings("home");
  const { getLocalizedName } = useLanguage();
  if (store.latitude == null || store.longitude == null) return null;
  const url = `https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}`;
  return (
    <Pressable onPress={() => Linking.openURL(url)} style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      accessibilityRole="button" accessibilityLabel={t.directionsTo(getLocalizedName(store))} hitSlop={6}>
      <Ionicons name="navigate" size={17} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#f0fdfa", borderWidth: 1, borderColor: "#ccfbf1", alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.7 },
});
