import { useState, type ReactNode } from "react";
import { View, Image, StyleSheet } from "react-native";
import { colors } from "../constants/theme";
import { useStore } from "../lib/store-context";

// A wordmark logo widens its plate up to this shape; a square logo keeps a square plate
const MAX_ASPECT = 1.8;

interface StoreMarkProps {
  storeId: string | null | undefined;
  /** The store's logo when the caller has it; otherwise it's found among the stores the app has loaded */
  logoUrl?: string | null;
  /** Height of the plate */
  size: number;
  /** What the spot showed before logos, for a store without one */
  fallback?: ReactNode;
}

/** The store's logo on a small white plate beside its name, or the spot's usual icon when the store has no logo */
export function StoreMark({ storeId, logoUrl, size, fallback = null }: StoreMarkProps) {
  const { stores, selectedStore } = useStore();
  const [aspect, setAspect] = useState(1);
  const known = selectedStore?.id === storeId ? selectedStore : stores.find((s) => s.id === storeId);
  const uri = logoUrl ?? known?.logoUrl;
  if (!uri) return <>{fallback}</>;
  return (
    <View style={[styles.plate, { height: size, width: size * Math.min(Math.max(aspect, 1), MAX_ASPECT), borderRadius: size * 0.28, padding: size * 0.1 }]}>
      <Image
        source={{ uri }} style={styles.image} resizeMode="contain" accessibilityIgnoresInvertColors
        onLoad={(e) => { const { width, height } = e.nativeEvent.source; if (width && height) setAspect(width / height); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  plate: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  image: { width: "100%", height: "100%" },
});
