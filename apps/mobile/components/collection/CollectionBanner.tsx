import { Image, StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "../../constants/theme";
import { useLanguage } from "../../lib/language-context";
import type { CollectionHeader } from "../../lib/types";

export function CollectionBanner({ collection }: { collection: CollectionHeader }) {
  const { language } = useLanguage();
  const title = (language && collection.translations?.[language]?.title) || collection.title;
  const subtitle = (language && collection.translations?.[language]?.subtitle) || collection.subtitle;
  const image = (language && collection.imageUrls?.[language]) || collection.imageUrl;
  const showText = !collection.textInImage || !image;

  return (
    <View style={styles.wrap}>
      {image ? (
        <Image
          source={{ uri: image }}
          style={styles.image}
          resizeMode="cover"
          accessible
          accessibilityRole="image"
          accessibilityLabel={collection.textInImage ? [title, subtitle].filter(Boolean).join(". ") : title}
        />
      ) : null}
      {showText ? (
        <View style={styles.text}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  image: { width: "100%", aspectRatio: 3 / 2, borderRadius: 20, backgroundColor: colors.border },
  text: { paddingTop: 12, gap: 4 },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.text },
  subtitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary },
});
