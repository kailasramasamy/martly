import { View, Text, Image, StyleSheet } from "react-native";
import { fonts } from "../../constants/theme";
import type { Store } from "../../lib/types";
import type { StoreBranding } from "./branding";

// Most shop logos are wordmarks, so an uploaded logo gets a wide plate rather than a square
const LOGO_ASPECT = 1.8;

/** The store's uploaded logo, or its initials on the brand colour; `size` is the height */
export function StoreLogo({ store, brand, size }: { store: Store; brand: StoreBranding; size: number }) {
  const box = { width: size, height: size, borderRadius: size * 0.28 };
  if (store.logoUrl) {
    return (
      <View style={[styles.frame, box, { width: size * LOGO_ASPECT, padding: size * 0.08 }]}>
        <Image source={{ uri: store.logoUrl }} style={styles.image} resizeMode="contain" />
      </View>
    );
  }
  return (
    <View style={[styles.frame, box, { backgroundColor: brand.color }]}>
      <Text style={[styles.initials, { color: brand.onColor, fontSize: size * 0.36 }]}>{brand.initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: "#fff", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  initials: { fontFamily: fonts.extrabold, letterSpacing: 0.5 },
});
