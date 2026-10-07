import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import type { Store } from "../../lib/types";
import { getOpenState, getStoreArea, formatDistance } from "./store-info";

interface CardProps {
  store: Store;
  onPress: (store: Store) => void;
}

function EtaChip({ minutes, onImage }: { minutes: number; onImage?: boolean }) {
  return (
    <View style={[styles.etaChip, onImage && styles.etaChipOnImage]}>
      <Ionicons name="flash" size={11} color={onImage ? colors.accentText : colors.primary} />
      <Text style={[styles.etaText, onImage && styles.etaTextOnImage]}>{minutes} min</Text>
    </View>
  );
}

function OpenStatus({ store }: { store: Store }) {
  const open = getOpenState(store);
  if (!open) return null;
  return (
    <View style={styles.inlineRow}>
      <View style={[styles.statusDot, { backgroundColor: open.isOpen ? colors.success : colors.textSecondary }]} />
      <Text style={styles.metaText}>{open.label}</Text>
    </View>
  );
}

function FreeDelivery({ threshold }: { threshold?: number | null }) {
  if (threshold == null) return null;
  return (
    <View style={styles.inlineRow}>
      <Ionicons name="bicycle-outline" size={13} color={colors.textSecondary} />
      <Text style={styles.metaText}>Free delivery over {"\u20B9"}{Number(threshold).toLocaleString("en-IN")}</Text>
    </View>
  );
}

export function FeaturedStoreCard({ store, onPress }: CardProps) {
  return (
    <Pressable style={({ pressed }) => [styles.featured, pressed && styles.pressed]} onPress={() => onPress(store)}>
      <View style={styles.featuredImageWrap}>
        {store.imageUrl ? <Image source={{ uri: store.imageUrl }} style={StyleSheet.absoluteFill} /> : null}
        <LinearGradient colors={["transparent", "rgba(15,23,42,0.82)"]} style={StyleSheet.absoluteFill} />
        {store.expressEtaMinutes ? <View style={styles.featuredEta}><EtaChip minutes={store.expressEtaMinutes} onImage /></View> : null}
        <View style={styles.featuredTitleBlock}>
          <Text style={styles.featuredName} numberOfLines={1}>{store.name}</Text>
          <Text style={styles.featuredArea} numberOfLines={1}>
            {getStoreArea(store)}{store.distance != null ? `  ·  ${formatDistance(store.distance)}` : ""}
          </Text>
        </View>
      </View>
      <View style={styles.featuredFooter}>
        <View style={styles.featuredMeta}>
          <OpenStatus store={store} />
          <FreeDelivery threshold={store.freeDeliveryThreshold} />
        </View>
        <View style={styles.shopBtn}>
          <Text style={styles.shopBtnText}>Shop</Text>
          <Ionicons name="arrow-forward" size={15} color="#fff" />
        </View>
      </View>
    </Pressable>
  );
}

export function StoreRow({ store, onPress, disabled }: CardProps & { disabled?: boolean }) {
  const detail = disabled && store.distance != null
    ? `${formatDistance(store.distance)} away · delivers within ${store.deliveryRadius} km`
    : [getStoreArea(store), store.distance != null ? formatDistance(store.distance) : null].filter(Boolean).join("  ·  ");
  return (
    <Pressable
      style={({ pressed }) => [styles.row, disabled && styles.rowDisabled, pressed && !disabled && styles.pressed]}
      onPress={() => onPress(store)}
      disabled={disabled}
      accessibilityState={{ disabled }}
    >
      <View style={styles.rowImage}>
        {store.imageUrl ? <Image source={{ uri: store.imageUrl }} style={StyleSheet.absoluteFill} /> : (
          <Ionicons name="storefront-outline" size={26} color={colors.primary} />
        )}
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>{store.name}</Text>
        <Text style={styles.rowDetail} numberOfLines={1}>{detail}</Text>
        {!disabled && (
          <View style={styles.rowMeta}>
            {store.expressEtaMinutes ? <EtaChip minutes={store.expressEtaMinutes} /> : null}
            <OpenStatus store={store} />
          </View>
        )}
      </View>
      {!disabled && (
        <View style={styles.chevron}>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  inlineRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  metaText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },

  etaChip: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#f0fdfa", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
  },
  etaChipOnImage: { backgroundColor: colors.accent, paddingHorizontal: 10, paddingVertical: 5 },
  etaText: { fontFamily: fonts.bold, fontSize: 12, color: colors.primary },
  etaTextOnImage: { color: colors.accentText, fontSize: 13 },

  featured: {
    backgroundColor: colors.background, borderRadius: 20, overflow: "hidden",
    borderWidth: 1, borderColor: colors.border,
    shadowColor: "#0f172a", shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  featuredImageWrap: { height: 176, backgroundColor: "#e2e8f0", justifyContent: "flex-end" },
  featuredEta: { position: "absolute", top: 14, left: 14 },
  featuredTitleBlock: { padding: 16, paddingBottom: 14 },
  featuredName: { fontFamily: fonts.extrabold, fontSize: 22, color: "#fff", letterSpacing: -0.3 },
  featuredArea: { fontFamily: fonts.medium, fontSize: 13.5, color: "rgba(255,255,255,0.85)", marginTop: 2 },
  featuredFooter: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  featuredMeta: { flex: 1, gap: 6 },
  shopBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 18, height: 44,
  },
  shopBtnText: { fontFamily: fonts.bold, fontSize: 15, color: "#fff" },

  row: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: colors.background, borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  rowDisabled: { opacity: 0.55, backgroundColor: colors.surface },
  rowImage: {
    width: 72, height: 72, borderRadius: 14, overflow: "hidden",
    backgroundColor: "#f0fdfa", alignItems: "center", justifyContent: "center",
  },
  rowBody: { flex: 1, gap: 3 },
  rowName: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  rowDetail: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  chevron: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: "#f0fdfa",
    alignItems: "center", justifyContent: "center",
  },
});
