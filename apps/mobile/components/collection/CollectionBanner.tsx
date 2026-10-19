import { Image, StyleSheet, View } from "react-native";
import { colors } from "../../constants/theme";
import { useLanguage } from "../../lib/language-context";
import type { CollectionHeader } from "../../lib/types";

/** The collection's banner art; its name and subtitle are in the navigation bar above */
export function CollectionBanner({ collection }: { collection: CollectionHeader }) {
  const { language } = useLanguage();
  const image = (language && collection.imageUrls?.[language]) || collection.imageUrl;
  if (!image) return null;
  const title = (language && collection.translations?.[language]?.title) || collection.title;
  const subtitle = (language && collection.translations?.[language]?.subtitle) || collection.subtitle;

  return (
    <View style={styles.wrap}>
      <Image
        source={{ uri: image }}
        style={styles.image}
        resizeMode="cover"
        accessible
        accessibilityRole="image"
        accessibilityLabel={collection.textInImage ? [title, subtitle].filter(Boolean).join(". ") : title}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 12 },
  image: { width: "100%", aspectRatio: 3 / 2, borderRadius: 20, backgroundColor: colors.border },
});
