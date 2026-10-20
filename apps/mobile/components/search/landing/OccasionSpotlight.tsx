import { FlatList, Image, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { fonts, spacing } from "../../../constants/theme";
import { ProductList } from "../../ProductList";
import { useLanguage } from "../../../lib/language-context";
import { useStrings } from "../../../lib/i18n/use-strings";
import type { LandingCollection } from "../../../lib/types";

// Festivals run warm (diya amber → marigold), seasons cool; text colours keep 4.5:1 on each tint
const THEMES = {
  OCCASION: { gradient: ["#fff7ed", "#ffedd5"] as const, accent: "#c2410c", ink: "#431407", kicker: "festivePicks" as const, icon: "sparkles" as const },
  SEASON: { gradient: ["#f0fdfa", "#e0f2fe"] as const, accent: "#0f766e", ink: "#083344", kicker: "inSeason" as const, icon: "leaf" as const },
};
type Theme = (typeof THEMES)[keyof typeof THEMES];

interface OccasionSpotlightProps {
  collection: LandingCollection;
  onSubcategory: (id: string) => void;
}

function Kicker({ theme, onPhoto }: { theme: Theme; onPhoto: boolean }) {
  const t = useStrings("search");
  return (
    <View style={[styles.badge, onPhoto ? styles.badgePhoto : { borderColor: theme.accent }]}>
      <Ionicons name={theme.icon} size={12} color={theme.accent} />
      <Text style={[styles.kicker, { color: theme.accent }]}>{t[theme.kicker].toUpperCase()}</Text>
    </View>
  );
}

function AislePills({ collection, theme, onPress }: { collection: LandingCollection; theme: Theme; onPress: (id: string) => void }) {
  const { getLocalizedName } = useLanguage();
  if (collection.subcategories.length < 2) return null;
  return (
    <FlatList
      horizontal
      data={collection.subcategories}
      keyExtractor={(s) => s.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.pills}
      renderItem={({ item }) => (
        <TouchableOpacity style={[styles.pill, { borderColor: `${theme.accent}33` }]} onPress={() => onPress(item.id)} hitSlop={{ top: 5, bottom: 5 }} accessibilityRole="button">
          <Text style={[styles.pillLabel, { color: theme.ink }]} numberOfLines={1}>{getLocalizedName(item)}</Text>
          <Ionicons name="chevron-forward" size={12} color={theme.accent} />
        </TouchableOpacity>
      )}
    />
  );
}

export function OccasionSpotlight({ collection, onSubcategory }: OccasionSpotlightProps) {
  const { language } = useLanguage();
  const theme = collection.kind === "OCCASION" ? THEMES.OCCASION : THEMES.SEASON;
  const localized = language ? collection.translations?.[language] : undefined;
  const title = localized?.title || collection.title;
  const subtitle = localized?.subtitle || collection.subtitle;
  const imageUrl = (language && collection.imageUrls?.[language]) || collection.imageUrl;
  // A text banner already carries the title, subtitle and button, so the app adds nothing on or under it
  const showCopy = !collection.textInImage || !imageUrl;
  return (
    <LinearGradient colors={theme.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      {imageUrl ? (
        <View style={[styles.art, collection.textInImage && styles.artBanner]}>
          <Image
            source={{ uri: imageUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            accessible={collection.textInImage}
            accessibilityLabel={collection.textInImage ? [title, subtitle].filter(Boolean).join(". ") : undefined}
          />
          {showCopy ? <Kicker theme={theme} onPhoto /> : null}
        </View>
      ) : null}
      {showCopy ? (
        <View style={styles.copy}>
          {imageUrl ? null : <Kicker theme={theme} onPhoto={false} />}
          <Text style={[styles.title, { color: theme.ink }]} numberOfLines={2}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: theme.ink }]} numberOfLines={2}>{subtitle}</Text> : null}
        </View>
      ) : null}
      <AislePills collection={collection} theme={theme} onPress={onSubcategory} />
      <ProductList products={collection.products} layout="rail" />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.md + 4, marginHorizontal: spacing.sm, paddingBottom: spacing.sm, borderRadius: 20, overflow: "hidden" },
  art: { aspectRatio: 2.1, padding: spacing.sm + 4, justifyContent: "flex-start", alignItems: "flex-start" },
  artBanner: { aspectRatio: 2 },
  copy: { paddingHorizontal: spacing.md - 4, paddingTop: spacing.md - 2, alignItems: "flex-start" },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgePhoto: { backgroundColor: "rgba(255,255,255,0.92)", borderColor: "transparent", paddingVertical: 4 },
  kicker: { fontFamily: fonts.extrabold, fontSize: 10, letterSpacing: 0.8 },
  title: { fontFamily: fonts.extrabold, fontSize: 20, letterSpacing: -0.4, marginTop: 8 },
  subtitle: { fontFamily: fonts.medium, fontSize: 13, opacity: 0.75, marginTop: 2 },
  pills: { gap: spacing.sm, paddingHorizontal: spacing.md - 4, paddingTop: spacing.sm + 4, paddingBottom: spacing.sm },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 4, minHeight: 36, paddingLeft: 12, paddingRight: 10,
    borderRadius: 18, borderWidth: 1, backgroundColor: "rgba(255,255,255,0.85)",
  },
  pillLabel: { fontFamily: fonts.semibold, fontSize: 13 },
});
