import { useState } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { fonts } from "../../constants/theme";
import type { Store } from "../../lib/types";
import type { StoreBranding } from "./branding";

// Most shop logos are wordmarks: the plate starts wide, then takes the logo's own shape once it loads
const LOGO_ASPECT = 1.8;
const MAX_ASPECT = 2.6;

interface StoreLogoProps {
  store: Store;
  brand: StoreBranding;
  /** Height of the plate */
  size: number;
  /** Widest the plate may grow for a wide logo */
  maxWidth?: number;
}

/** The store's uploaded logo on a plate shaped like it, or its initials on the brand colour */
export function StoreLogo({ store, brand, size, maxWidth = Infinity }: StoreLogoProps) {
  const [aspect, setAspect] = useState(LOGO_ASPECT);
  const box = { width: size, height: size, borderRadius: size * 0.28 };
  if (store.logoUrl) {
    const width = Math.min(size * Math.min(Math.max(aspect, 1), MAX_ASPECT), maxWidth);
    return (
      <View style={[styles.frame, box, { width, padding: size * 0.08 }]}>
        <Image
          source={{ uri: store.logoUrl }}
          style={styles.image}
          resizeMode="contain"
          onLoad={(e) => { const { width: w, height: h } = e.nativeEvent.source; if (w && h) setAspect(w / h); }}
        />
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
