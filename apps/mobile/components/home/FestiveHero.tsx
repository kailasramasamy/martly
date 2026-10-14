import { useEffect, useMemo, useRef } from "react";
import { Animated, Dimensions, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fonts } from "../../constants/theme";
import { useLanguage } from "../../lib/language-context";
import type { FestiveHero as FestiveHeroData, FestiveTile } from "../../lib/types";

const SCREEN_WIDTH = Dimensions.get("window").width;
const H_PADDING = 16;
const GAP = 10;
// The artwork is 2:3; the server measures how far its ornament hangs, and the headline tucks in right under it
const ART_HEIGHT = SCREEN_WIDTH * 1.5;
const MIN_TOP = 12;
const TILE_WIDTH = Math.floor((SCREEN_WIDTH - H_PADDING * 2 - GAP * 2) / 3);
const TILE_HEIGHT = Math.round(TILE_WIDTH * 1.24);
// The festival colour trails past the hero and behind the next sections, melting into the page background
const TRAIL_HEIGHT = 220;
const TRAIL_STOPS = [0, 0.45, 1] as const;
// The wash drifts a shade across the artwork, so its cut-off edge is blended into the sampled colour first
const SEAM_HEIGHT = 72;
const STAGGER_MS = 70;
// Cards are tones of the festival's own wash: lifted towards white behind the label, deepened under the art
const CARD_STOPS = [0, 0.5, 1] as const;
const CARD_LIFT = 0.7;
const CARD_DEEPEN = 0.1;
const CARD_EDGE = 0.16;

function mix(hex: string, target: number, amount: number) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `#${channels.map((c) => Math.round(c + (target - c) * amount).toString(16).padStart(2, "0")).join("")}`;
}

interface Props {
  hero: FestiveHeroData;
  onTile: (tile: FestiveTile) => void;
}

function useLocalizedTitle() {
  const { language } = useLanguage();
  return (item: { title: string; translations: FestiveTile["translations"] }) =>
    (language && item.translations?.[language]?.title) || item.title;
}

interface TileProps {
  tile: FestiveTile;
  /** Lifted, base and deepened card fills, then the border */
  tones: readonly [string, string, string, string];
  index: number;
  onPress: () => void;
}

function Tile({ tile, tones, index, onPress }: TileProps) {
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
        style={({ pressed }) => [styles.tile, { borderColor: tones[3] }, pressed && styles.tilePressed]}
      >
        <LinearGradient colors={[tones[0], tones[1], tones[2]]} locations={CARD_STOPS} style={styles.tileFill}>
          <Text style={styles.tileTitle} numberOfLines={2}>{title}</Text>
          <Image source={{ uri: tile.imageUrl }} style={styles.tileArt} resizeMode="contain" />
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

/** The festive top of the home screen: AI artwork, a headline, and a grid of themed shopping tiles. */
export function FestiveHero({ hero, onTile }: Props) {
  const title = useLocalizedTitle()(hero);
  const { background, title: ink, ornamentDepth } = hero.theme;
  const top = Math.max(MIN_TOP, Math.round(ornamentDepth * ART_HEIGHT));
  const trail = useMemo(() => [background, `${background}66`, colors.surface] as const, [background]);
  const seam = useMemo(() => [`${background}00`, background] as const, [background]);
  const tones = useMemo(() => [mix(background, 255, CARD_LIFT), background, mix(background, 0, CARD_DEEPEN), mix(background, 0, CARD_EDGE)] as const, [background]);

  return (
    <View>
      <View style={[styles.hero, { backgroundColor: background, paddingTop: top }]}>
        <Image source={{ uri: hero.imageUrl }} style={styles.art} resizeMode="cover" />
        <LinearGradient colors={seam} style={styles.seam} pointerEvents="none" />
        <View style={styles.headline} accessibilityRole="header">
          <Text style={[styles.flourish, { color: ink }]}>✦</Text>
          <Text style={[styles.title, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{title}</Text>
          <Text style={[styles.flourish, { color: ink }]}>✦</Text>
        </View>
        <View style={styles.grid}>
          {hero.tiles.map((tile, i) => (
            <Tile key={tile.id} tile={tile} tones={tones} index={i} onPress={() => onTile(tile)} />
          ))}
        </View>
      </View>
      <LinearGradient colors={trail} locations={TRAIL_STOPS} style={styles.trail} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingBottom: 16, overflow: "hidden" },
  art: { position: "absolute", top: 0, left: 0, width: SCREEN_WIDTH, height: ART_HEIGHT },
  // Kept to the middle of the screen so it never runs into ornament along the side edges
  headline: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    alignSelf: "center", maxWidth: SCREEN_WIDTH * 0.64, marginBottom: 12,
  },
  flourish: { fontSize: 10 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 34, letterSpacing: 0.6, flexShrink: 1, textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP, paddingHorizontal: H_PADDING },
  tile: { width: TILE_WIDTH, height: TILE_HEIGHT, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  tilePressed: { transform: [{ scale: 0.96 }], opacity: 0.9 },
  tileFill: { flex: 1, paddingTop: 10, alignItems: "center" },
  tileTitle: {
    fontFamily: fonts.bold, fontSize: 13, lineHeight: 16, color: colors.text,
    textAlign: "center", paddingHorizontal: 6, minHeight: 32,
  },
  tileArt: { flex: 1, width: TILE_WIDTH - 12, marginTop: 4, marginBottom: 6 },
  seam: { position: "absolute", left: 0, right: 0, bottom: 0, height: SEAM_HEIGHT },
  trail: { position: "absolute", left: 0, right: 0, top: "100%", height: TRAIL_HEIGHT },
});
