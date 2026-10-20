import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Image, Pressable, StyleSheet, Text, View, type ImageLoadEventData } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, festiveFonts, fonts } from "../../constants/theme";
import { useLanguage } from "../../lib/language-context";
import { mix } from "./color-mix";
import type { FestiveHero as FestiveHeroData, FestiveTile } from "../../lib/types";

const SCREEN_WIDTH = Dimensions.get("window").width;
const H_PADDING = 16;
const GAP = 10;
const MIN_TOP = 12;
// Room for the three-line greeting even when the strip art is short or missing
const MIN_STRIP_HEIGHT = 150;
// How far the search bar's gap and the tiles reach into the strip's faded edges
const STRIP_OVERLAP_TOP = 16;
const STRIP_OVERLAP_BOTTOM = 12;
const TILE_WIDTH = Math.floor((SCREEN_WIDTH - H_PADDING * 2 - GAP * 2) / 3);
const TILE_HEIGHT = Math.round(TILE_WIDTH * 1.18);
const TALL_TILE_HEIGHT = TILE_HEIGHT * 2 + GAP;
// The silhouette strip is wide and low; until its real size loads, assume the server's usual crop
const DEFAULT_STRIP_ASPECT = 2.6;
// Older heroes stored a tall painted background; it isn't a strip, so it's left out rather than squashed
const MIN_STRIP_ASPECT = 1.2;
const FEATURE_TILES = 5;
const STAGGER_MS = 70;
// Cards are warm cream on the solid festival colour, edged with a hint of that colour so they sit in it
const CARD_STOPS = [0, 0.55, 1] as const;
const CARD_FILL = ["#fffaf0", "#fdf3dc", "#f9e9c6"] as const;
const CARD_EDGE = 0.55;

interface Props {
  hero: FestiveHeroData;
  onTile: (tile: FestiveTile) => void;
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
  edge: string;
  index: number;
  onPress: () => void;
  /** Spans two rows: the FEATURE layout's lead tile */
  tall?: boolean;
}

function Tile({ tile, edge, index, onPress, tall = false }: TileProps) {
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
        style={({ pressed }) => [styles.tile, tall && styles.tileTall, { borderColor: edge }, pressed && styles.tilePressed]}
      >
        <LinearGradient colors={CARD_FILL} locations={CARD_STOPS} style={styles.tileFill}>
          <Text style={styles.tileTitle} numberOfLines={2}>{title}</Text>
          <Image source={{ uri: tile.imageUrl }} style={styles.tileArt} resizeMode="contain" />
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

interface TilesProps {
  hero: FestiveHeroData;
  edge: string;
  onTile: (tile: FestiveTile) => void;
}

/** Tiles in rows of three; a FEATURE hero's five instead put the first tall on the left beside a 2x2 block */
function TileGrid({ hero, edge, onTile }: TilesProps) {
  const { tiles } = hero;
  const featured = hero.tileLayout === "FEATURE" && tiles.length === FEATURE_TILES;
  if (!featured) {
    return (
      <View style={styles.grid}>
        {tiles.map((tile, i) => <Tile key={tile.id} tile={tile} edge={edge} index={i} onPress={() => onTile(tile)} />)}
      </View>
    );
  }
  const [lead, ...rest] = tiles;
  return (
    <View style={styles.feature}>
      <Tile tile={lead} edge={edge} index={0} tall onPress={() => onTile(lead)} />
      <View style={styles.featureBlock}>
        {rest.map((tile, i) => <Tile key={tile.id} tile={tile} edge={edge} index={i + 1} onPress={() => onTile(tile)} />)}
      </View>
    </View>
  );
}

function useGreeting(hero: FestiveHeroData) {
  const { language } = useLanguage();
  const ta = language ? hero.translations?.[language] : undefined;
  return {
    kicker: ta?.kicker || hero.kicker,
    title: ta?.title || hero.title,
    subtitle: ta?.subtitle || hero.subtitle,
    translated: !!ta?.title,
  };
}

interface StripProps {
  hero: FestiveHeroData;
}

/** The silhouette strip with the three-line greeting set over its calm centre */
function GreetingStrip({ hero }: StripProps) {
  const { kicker, title, subtitle, translated } = useGreeting(hero);
  const { title: ink, font } = hero.theme;
  const fontFamily = festiveFonts[font ?? "PLAYFAIR"] ?? festiveFonts.PLAYFAIR;
  // The art's own proportions, read when it loads, size the box; the art is contained, never cropped, so its faded
  // edges always show and any spare room is the same theme colour
  const [aspect, setAspect] = useState(DEFAULT_STRIP_ASPECT);
  const onLoad = useCallback((e: ImageLoadEventData) => {
    const { width, height: h } = e.source;
    if (width > 0 && h > 0) setAspect(width / h);
  }, []);
  const height = Math.max(MIN_STRIP_HEIGHT, aspect >= MIN_STRIP_ASPECT ? SCREEN_WIDTH / aspect : 0);

  return (
    <View style={[styles.strip, { height }]}>
      {aspect >= MIN_STRIP_ASPECT && (
        <Image
          source={{ uri: hero.imageUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
          onLoad={(e) => onLoad(e.nativeEvent)}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      )}
      <View style={styles.greeting} accessibilityRole="header">
        {kicker ? <Text style={[styles.kicker, { color: ink }]} numberOfLines={translated ? 2 : 1}>✦ {kicker} ✦</Text> : null}
        {translated ? (
          // The display faces are Latin-only, and iOS fit-to-width shrinks Tamil past minimumFontScale to a speck,
          // so a translated title is set in the app face and wraps instead
          <Text style={[styles.titleTranslated, { color: ink }]} numberOfLines={2}>{title}</Text>
        ) : (
          <Text style={[styles.title, { color: ink, fontFamily }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {title}
          </Text>
        )}
        {subtitle ? <Text style={[styles.subtitle, { color: ink }]} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

/** The festive top of the home screen: one solid festival colour from the very top of the screen, a strip of
 *  tone-on-tone silhouettes under the search bar carrying the greeting, and a grid of themed shopping tiles. */
export function FestiveHero({ hero, onTile, backdrop }: Props) {
  const { background } = hero.theme;
  const edge = useMemo(() => mix(background, 255, CARD_EDGE), [background]);
  const top = backdrop ? backdrop.top : MIN_TOP;

  return (
    <View>
      <View style={[styles.hero, { backgroundColor: background, paddingTop: top }]}>
        <GreetingStrip hero={hero} />
        <TileGrid hero={hero} edge={edge} onTile={onTile} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingBottom: 18, overflow: "hidden" },
  // The art's top and bottom fade into the theme colour, so the search bar's gap and the tiles overlap them
  strip: { width: SCREEN_WIDTH, justifyContent: "center", marginTop: -STRIP_OVERLAP_TOP, marginBottom: -STRIP_OVERLAP_BOTTOM },
  greeting: { alignItems: "center", paddingHorizontal: 40, gap: 2 },
  kicker: { fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 0.6, opacity: 0.9 },
  title: { fontSize: 30, lineHeight: 40, letterSpacing: 0.2, textAlign: "center" },
  titleTranslated: { fontFamily: fonts.extrabold, fontSize: 24, lineHeight: 34, textAlign: "center" },
  subtitle: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, textAlign: "center", opacity: 0.92 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP, paddingHorizontal: H_PADDING },
  feature: { flexDirection: "row", gap: GAP, paddingHorizontal: H_PADDING },
  featureBlock: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: GAP },
  tile: { width: TILE_WIDTH, height: TILE_HEIGHT, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  tileTall: { height: TALL_TILE_HEIGHT },
  tilePressed: { transform: [{ scale: 0.96 }], opacity: 0.9 },
  tileFill: { flex: 1, paddingTop: 10, alignItems: "center" },
  tileTitle: {
    fontFamily: fonts.bold, fontSize: 13, lineHeight: 16, color: colors.text,
    textAlign: "center", paddingHorizontal: 6, minHeight: 32,
  },
  tileArt: { flex: 1, width: TILE_WIDTH - 12, marginTop: 4, marginBottom: 6 },
});
