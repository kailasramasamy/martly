import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../constants/theme";
import { useStrings } from "../lib/i18n/use-strings";
import { useLanguage } from "../lib/language-context";
import type { Store } from "../lib/types";
import { StoreMark } from "./StoreMark";

interface Props {
  store: Store | null;
  userArea: string | null;
  pickupOnly: boolean;
  onPress: () => void;
  /** Text colour when the header sits over festive art */
  ink?: string | null;
}

// Home header: leads with the delivery promise once a store is chosen (or says it is pickup only), otherwise with the user's area
export function HomeHeaderLocation({ store, userArea, pickupOnly, onPress, ink }: Props) {
  const t = useStrings("home");
  const { getLocalizedName } = useLanguage();
  const name = store ? getLocalizedName(store) : "";
  const eta = pickupOnly ? null : store?.expressEtaMinutes;
  const headline = store
    ? eta ? t.deliveryInMinutes(eta) : name
    : userArea ?? t.chooseStore;
  const caption = store ? (eta ? name : pickupOnly ? t.pickupOnly : t.deliveringFrom) : t.deliveringTo;
  const strong = ink ? { color: ink } : null;
  const soft = ink ? { color: ink, opacity: 0.8 } : null;
  const chevron = ink ?? colors.textSecondary;

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t.locationA11y(headline, caption)}
    >
      {/* The store's logo stands in for the pin; the express promise then moves beside the headline */}
      {store?.logoUrl ? <StoreMark storeId={store.id} logoUrl={store.logoUrl} size={38} /> : (
        <View style={[styles.icon, eta ? styles.iconFast : null]}>
          <Ionicons name={eta ? "flash" : "location-sharp"} size={18} color={eta ? "#b45309" : colors.primary} />
        </View>
      )}
      <View style={styles.text}>
        {eta ? (
          <>
            <View style={styles.captionRow}>
              {store?.logoUrl ? <Ionicons name="flash" size={15} color={ink ?? "#b45309"} /> : null}
              <Text style={[styles.headline, strong]} numberOfLines={1}>{headline}</Text>
            </View>
            <View style={styles.captionRow}>
              <Text style={[styles.caption, soft]} numberOfLines={1}>{caption}</Text>
              <Ionicons name="chevron-down" size={13} color={chevron} />
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.label, soft]}>{caption.toUpperCase()}</Text>
            <View style={styles.captionRow}>
              <Text style={[styles.headlineSmall, strong]} numberOfLines={1}>{headline}</Text>
              <Ionicons name="chevron-down" size={14} color={chevron} />
            </View>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", flex: 1, gap: 10 },
  icon: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: "#f0fdfa", alignItems: "center", justifyContent: "center",
  },
  iconFast: { backgroundColor: "#fef3c7" },
  text: { flex: 1 },
  headline: { fontFamily: fonts.extrabold, fontSize: 18, lineHeight: 22, color: colors.text, letterSpacing: -0.3 },
  headlineSmall: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, flexShrink: 1 },
  captionRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 1 },
  caption: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary, flexShrink: 1 },
  label: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.8, color: "#94a3b8" },
});
