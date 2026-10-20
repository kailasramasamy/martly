import { View, Text, Image, Pressable, FlatList, StyleSheet } from "react-native";
import { colors, fonts } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";
import type { Store } from "../../lib/types";
import { useStoreBranding } from "./branding";
import { StoreLogo } from "./StoreLogo";

const POSTER = 232;

interface Poster {
  key: string;
  uri: string;
  store: Store;
}

function PosterTile({ poster, onPress }: { poster: Poster; onPress: (store: Store) => void }) {
  const brand = useStoreBranding(poster.store);
  const t = useStrings("home");
  return (
    <Pressable style={({ pressed }) => [styles.tile, pressed && styles.pressed]} onPress={() => onPress(poster.store)}
      accessibilityRole="button" accessibilityLabel={t.offerFrom(brand.name)}>
      <Image source={{ uri: poster.uri }} style={styles.poster} resizeMode="cover" />
      <View style={styles.caption}>
        <StoreLogo store={poster.store} brand={brand} size={24} />
        <Text style={styles.storeName} numberOfLines={1}>{brand.name}</Text>
      </View>
    </Pressable>
  );
}

/** Store owners' own promo posters; tapping one picks that store. Hidden when no store has posters */
export function PromoPosterStrip({ stores, onSelect }: { stores: Store[]; onSelect: (store: Store) => void }) {
  const t = useStrings("home");
  const posters: Poster[] = stores.flatMap((store) => (store.promoImages ?? []).map((uri, i) => ({ key: `${store.id}-${i}`, uri, store })));
  if (posters.length === 0) return null;
  return (
    <View>
      <Text style={styles.title}>{t.offersNearYou}</Text>
      <FlatList
        horizontal
        data={posters}
        keyExtractor={(p) => p.key}
        renderItem={({ item }) => <PosterTile poster={item} onPress={onSelect} />}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        style={styles.bleed}
        snapToInterval={POSTER + 12}
        decelerationRate="fast"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.text, letterSpacing: -0.2, marginTop: 12, marginBottom: 10 },
  bleed: { marginHorizontal: -16 },
  list: { paddingHorizontal: 16, gap: 12 },
  tile: { width: POSTER },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  poster: { width: POSTER, height: POSTER, borderRadius: 18, backgroundColor: "#e2e8f0" },
  caption: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  storeName: { flex: 1, fontFamily: fonts.bold, fontSize: 13.5, color: colors.text },
});
