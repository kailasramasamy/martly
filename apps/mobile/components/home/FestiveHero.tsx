import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Dimensions, FlatList, Image, Pressable, StyleSheet, Text, View, type ImageLoadEventData } from "react-native";
import { colors, festiveFonts, fonts } from "../../constants/theme";
import { useLanguage } from "../../lib/language-context";
import { useStrings } from "../../lib/i18n/use-strings";
import type { FestiveHero as FestiveHeroData, FestiveTile } from "../../lib/types";

const SCREEN_WIDTH = Dimensions.get("window").width;
const H_PADDING = 16;
const GAP = 8;
const MIN_TOP = 12;
// The strip rises this far behind the overlaid header, so its garlands sit behind the pills and the scene shows above the tiles
const STRIP_RISE = 46;
// The silhouette strip is wide and low; until its real size loads, assume the server's usual crop
const DEFAULT_STRIP_ASPECT = 2.6;
// Older heroes stored a tall painted background; it isn't a strip, so it's left out rather than squashed
const MIN_STRIP_ASPECT = 1.2;
const TILE_WIDTH = 98;
const STAGGER_MS = 70;

interface Props {
  hero: FestiveHeroData;
  /** Opens the festival, at the tapped tile or (See all) at its first */
  onOpen: (tile?: FestiveTile) => void;
  /** The block runs up behind the overlaid home header; this is the header's height to clear */
  backdrop?: { top: number } | null;
}

function useLocalizedTitle() {
  const { language } = useLanguage();
  return (item: { title: string; translations: FestiveTile["translations"] }) =>
    (language && item.translations?.[language]?.title) || item.title;
}

interface TileProps {
  tile: FestiveTile;
  ink: string;
  index: number;
  onPress: () => void;
}

function Tile({ tile, ink, index, onPress }: TileProps) {
  const title = useLocalizedTitle()(tile);
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(rise, { toValue: 1, duration: 380, delay: index * STAGGER_MS, useNativeDriver: true }).start();
  }, [rise, index]);
  const translateY = rise.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });

  return (
    <Animated.View style={{ opacity: rise, transform: [{ translateY }] }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={title}
        style={({ pressed }) => [styles.tile, { shadowColor: ink }, pressed && styles.tilePressed]}
      >
        <Image source={{ uri: tile.imageUrl }} style={styles.tileArt} resizeMode="contain" />
        <Text style={styles.tileTitle} numberOfLines={2}>{title}</Text>
      </Pressable>
    </Animated.View>
  );
}

function useGreeting(hero: FestiveHeroData) {
  const { language } = useLanguage();
  const ta = language ? hero.translations?.[language] : undefined;
  return { kicker: ta?.kicker || hero.kicker, title: ta?.title || hero.title, translated: !!ta?.title };
}

/** The faint silhouette strip behind the header's pills and the greeting, at the art's own proportions */
function Strip({ hero, top }: { hero: FestiveHeroData; top: number }) {
  const [aspect, setAspect] = useState(DEFAULT_STRIP_ASPECT);
  const onLoad = useCallback((e: ImageLoadEventData) => {
    const { width, height } = e.source;
    if (width > 0 && height > 0) setAspect(width / height);
  }, []);
  if (aspect < MIN_STRIP_ASPECT) return null;
  return (
    <Image
      source={{ uri: hero.imageUrl }}
      style={[styles.strip, { top: top - STRIP_RISE, height: SCREEN_WIDTH / aspect }]}
      resizeMode="cover"
      onLoad={(e) => onLoad(e.nativeEvent)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

/** Kicker and headline on the left in the festival's ink, See all on the right */
function Greeting({ hero, onSeeAll }: { hero: FestiveHeroData; onSeeAll: () => void }) {
  const c = useStrings("common");
  const { kicker, title, translated } = useGreeting(hero);
  const { title: ink, font } = hero.theme;
  const fontFamily = festiveFonts[font ?? "PLAYFAIR"] ?? festiveFonts.PLAYFAIR;
  return (
    <View style={styles.greeting}>
      <View style={styles.greetingText} accessibilityRole="header">
        {kicker ? <Text style={[styles.kicker, { color: ink }]} numberOfLines={translated ? 2 : 1}>✦ {kicker}</Text> : null}
        {translated ? (
          // The display faces are Latin-only, and iOS fit-to-width shrinks Tamil past minimumFontScale to a speck,
          // so a translated title is set in the app face and wraps instead
          <Text style={[styles.titleTranslated, { color: ink }]} numberOfLines={2}>{title}</Text>
        ) : (
          <Text style={[styles.title, { color: ink, fontFamily }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {title}
          </Text>
        )}
      </View>
      <Pressable onPress={onSeeAll} accessibilityRole="button" style={({ pressed }) => [styles.seeAll, pressed && styles.tilePressed]}>
        <Text style={[styles.seeAllText, { color: ink }]}>{c.seeAll} ›</Text>
      </Pressable>
    </View>
  );
}

/** The festive top of the home screen: a pale festival wash from the very top of the screen with a faint silhouette
 *  strip behind the header and the greeting, then a row of themed shopping tiles. */
export function FestiveHero({ hero, onOpen, backdrop }: Props) {
  const { background, title: ink } = hero.theme;
  const top = backdrop ? backdrop.top : MIN_TOP;
  const onSeeAll = useCallback(() => onOpen(), [onOpen]);

  return (
    <View style={[styles.hero, { backgroundColor: background, paddingTop: top }]}>
      <Strip hero={hero} top={top} />
      <Greeting hero={hero} onSeeAll={onSeeAll} />
      <FlatList
        horizontal
        data={hero.tiles}
        keyExtractor={(tile) => tile.id}
        renderItem={({ item, index }) => <Tile tile={item} ink={ink} index={index} onPress={() => onOpen(item)} />}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tiles}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingBottom: 16, overflow: "hidden" },
  strip: { position: "absolute", left: 0, width: SCREEN_WIDTH },
  greeting: { flexDirection: "row", alignItems: "flex-end", gap: 12, paddingHorizontal: H_PADDING, paddingTop: 14 },
  greetingText: { flex: 1 },
  kicker: { fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 0.3, opacity: 0.85 },
  title: { fontSize: 28, lineHeight: 36, letterSpacing: 0.2 },
  titleTranslated: { fontFamily: fonts.extrabold, fontSize: 22, lineHeight: 30 },
  seeAll: {
    minHeight: 44, justifyContent: "center", paddingHorizontal: 14, borderRadius: 22,
    backgroundColor: colors.background, marginBottom: -4,
  },
  seeAllText: { fontFamily: fonts.extrabold, fontSize: 13 },
  tiles: { gap: GAP, paddingHorizontal: H_PADDING, paddingTop: 18, paddingBottom: 4 },
  tile: {
    width: TILE_WIDTH, borderRadius: 14, backgroundColor: colors.background, alignItems: "center",
    paddingTop: 8, paddingHorizontal: 6, paddingBottom: 8,
    shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  tilePressed: { transform: [{ scale: 0.96 }], opacity: 0.9 },
  tileArt: { width: 78, height: 72 },
  tileTitle: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 15, color: colors.text, textAlign: "center", marginTop: 4, minHeight: 30 },
});
