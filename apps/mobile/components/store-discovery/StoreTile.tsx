import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { strings } from "../../lib/i18n";
import { useStrings } from "../../lib/i18n/use-strings";
import type { Store } from "../../lib/types";
import { useStoreBranding } from "./branding";
import { StoreLogo } from "./StoreLogo";
import { formatDistance } from "./store-info";

export const TILE_WIDTH = 124;

interface StoreTileProps {
  store: Store;
  active: boolean;
  /** Can't be chosen from here, e.g. outside the delivery area */
  muted: boolean;
  onPress: (store: Store) => void;
}

function shortDistance(store: Store): string | null {
  if (store.drive) return `${formatDistance(store.drive.km)} · ${strings("home").minutes(store.drive.minutes)}`;
  return store.distance != null ? formatDistance(store.distance) : null;
}

/** A store at a glance in the strip: logo, name, express time and how far */
export function StoreTile({ store, active, muted, onPress }: StoreTileProps) {
  const brand = useStoreBranding(store);
  const t = useStrings("home");
  const far = shortDistance(store);
  return (
    <Pressable
      onPress={() => onPress(store)}
      style={({ pressed }) => [styles.tile, active && { borderColor: brand.color, borderWidth: 2, padding: 9 }, muted && styles.muted, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={brand.name}
    >
      <View style={[styles.logoWell, { backgroundColor: brand.tint }]}>
        <StoreLogo store={store} brand={brand} size={40} />
        {(store.promoImages?.length ?? 0) > 0 && <View style={styles.offerDot} />}
      </View>
      <Text style={styles.name} numberOfLines={2}>{brand.name}</Text>
      {muted ? (
        <Text style={styles.outside} numberOfLines={1}>{t.outsideArea}</Text>
      ) : (
        <View style={styles.meta}>
          {store.expressEtaMinutes ? (
            <View style={styles.eta}>
              <Ionicons name="flash" size={10} color={colors.primary} />
              <Text style={styles.etaText}>{t.minutes(store.expressEtaMinutes)}</Text>
            </View>
          ) : null}
          {far ? <Text style={styles.far} numberOfLines={1}>{far}</Text> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { width: TILE_WIDTH, padding: 10, borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, gap: 6 },
  muted: { opacity: 0.55 },
  pressed: { opacity: 0.85 },
  logoWell: { height: 58, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  offerDot: { position: "absolute", top: 6, right: 6, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent, borderWidth: 2, borderColor: "#fff" },
  name: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 17, color: colors.text, minHeight: 34 },
  meta: { gap: 3 },
  eta: { flexDirection: "row", alignItems: "center", gap: 2 },
  etaText: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.primary },
  far: { fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary },
  outside: { fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary },
});
