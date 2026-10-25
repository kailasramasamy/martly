import { Image, StyleSheet, View } from "react-native";

const WOOD = "#c89b62";
const WOOD_EDGE = "#a7783f";

/** One shelf of packs: product photos standing on a wooden plank */
export function ShelfRow({ images, gap = 4 }: { images: string[]; gap?: number }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.packs, { gap }]}>
        {images.map((uri) => (
          <View key={uri} style={styles.pack}>
            <Image source={{ uri }} style={styles.image} />
          </View>
        ))}
      </View>
      <View style={styles.plank} />
      <View style={styles.edge} />
    </View>
  );
}

const styles = StyleSheet.create({
  packs: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 4 },
  pack: { flex: 1, alignItems: "center" },
  image: { width: "100%", aspectRatio: 1, resizeMode: "contain" },
  plank: { height: 6, borderTopLeftRadius: 2, borderTopRightRadius: 2, backgroundColor: WOOD },
  edge: { height: 3, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, backgroundColor: WOOD_EDGE },
});
