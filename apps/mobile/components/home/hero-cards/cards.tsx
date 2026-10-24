import { memo, type ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { DayPart } from "@martly/shared/constants";
import type { HeroCard } from "@martly/shared/types";
import { colors, fonts } from "../../../constants/theme";
import { useLanguage } from "../../../lib/language-context";
import { useStrings } from "../../../lib/i18n/use-strings";
import type { StoreProduct } from "../../../lib/types";
import { openCollection, useHomeSectionEnv } from "../sections/context";
import { HERO_CARD_PADDING, HeroCardFrame, HeroCardHead, HeroCardLink, HeroProductLine } from "./HeroCardFrame";

type Card = HeroCard<StoreProduct>;
const FESTIVAL_TILES = 6;
const SPECIAL_AISLES = 4;

// Aisles have no art of their own, so each is pictured by the range's first product in it
function aisleTiles(collection: CardOf<"STORE_SPECIAL">["collection"]) {
  return collection.subcategories.map((sub) => {
    const pictured = collection.products.find((p) => p.product.subcategory?.id === sub.id);
    return { ...sub, translations: sub.translations as Record<string, { name?: string }> | null, imageUrl: pictured ? pictured.product.imageUrl || pictured.variant.imageUrl : null };
  });
}
const pairs = <T,>(items: T[]) => items.flatMap((item, i) => (i % 2 === 0 ? [items.slice(i, i + 2)] : []));
type CardOf<K extends Card["kind"]> = Extract<Card, { kind: K }>;

/** A product list card: a lighter band with the title (and a badge where artwork would sit), then rows of products */
function ProductListCard({ card, title, subtitle, badge, link, onPress }: {
  card: CardOf<"BUY_GET" | "MOST_BOUGHT" | "RIGHT_NOW">; title: string; subtitle: string; badge?: ReactNode; link?: string; onPress?: () => void;
}) {
  const { theme } = card;
  return (
    <HeroCardFrame theme={theme} onPress={onPress} label={title}>
      <View style={[styles.band, { backgroundColor: theme.tintSoft }]}>
        <View style={styles.bandText}>
          {/* Tamil titles run long: shrink them to the band rather than cut them */}
          <Text style={[styles.bandTitle, { color: theme.cardInk }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{title}</Text>
          <Text style={[styles.bandSubtitle, { color: theme.cardInk }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{subtitle}</Text>
        </View>
        {badge}
      </View>
      <View style={styles.lines}>
        {card.products.map((p) => <HeroProductLine key={p.id} item={p} ink={theme.cardInk} />)}
      </View>
      {link ? <HeroCardLink label={link} color={theme.cardInk} /> : null}
    </HeroCardFrame>
  );
}

function BuyGetCard({ card }: { card: CardOf<"BUY_GET"> }) {
  const t = useStrings("home");
  const c = useStrings("common");
  return (
    <ProductListCard
      card={card} title={t.buyGetTitle} subtitle={t.buyGetCount(card.total)} link={c.viewAll} onPress={() => router.push("/buy-get")}
      badge={<View style={styles.badge}><Text style={styles.badgeText}>1+1</Text></View>}
    />
  );
}

function MostBoughtCard({ card }: { card: CardOf<"MOST_BOUGHT"> }) {
  const t = useStrings("home");
  const { store } = useHomeSectionEnv();
  const { getLocalizedName } = useLanguage();
  const c = useStrings("common");
  return (
    <ProductListCard
      card={card} title={t.heroMostBought} subtitle={t.heroMostBoughtSub(getLocalizedName(store))} link={c.viewAll}
      onPress={() => router.push("/most-bought")}
    />
  );
}

/** The store's own range: its photo across the top, then its aisles (each opening the range narrowed to it) and "Shop now" */
function StoreSpecialCard({ card }: { card: CardOf<"STORE_SPECIAL"> }) {
  const t = useStrings("home");
  const { language, getLocalizedName } = useLanguage();
  const { collection, theme } = card;
  const localized = language ? (collection.translations as Record<string, { title?: string; subtitle?: string }> | null)?.[language] : undefined;
  const title = localized?.title || collection.title;
  const subtitle = localized?.subtitle || collection.subtitle;
  const imageUrl = (language && collection.imageUrls?.[language]) || collection.imageUrl;
  // A text banner already carries the title, so the photo takes the title's room
  const showCopy = !collection.textInImage || !imageUrl;
  return (
    <HeroCardFrame theme={theme} onPress={() => openCollection(collection.id)} label={title}>
      {imageUrl ? (
        <View style={[styles.photo, !showCopy && styles.photoTall]}>
          <Image source={{ uri: imageUrl }} style={styles.photoImage} resizeMode="cover" />
          <View style={styles.onlyHere}><Text style={[styles.onlyHereText, { color: theme.cardInk }]}>{t.heroOnlyHere}</Text></View>
        </View>
      ) : null}
      {showCopy && (
        <View style={styles.copy}>
          <Text style={[styles.bandTitle, { color: theme.cardInk }]} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={[styles.bandSubtitle, { color: theme.cardInk }]} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      )}
      <View style={styles.aisles}>
        {pairs(aisleTiles(collection).slice(0, SPECIAL_AISLES)).map((row) => (
          <View key={row[0].id} style={styles.tileRow}>
            {row.map((aisle) => (
              <Pressable
                key={aisle.id} style={[styles.aisle, { backgroundColor: theme.tintSoft }]}
                onPress={() => openCollection(collection.id, [aisle.id])} accessibilityRole="link" accessibilityLabel={getLocalizedName(aisle)}
              >
                {aisle.imageUrl ? <Image source={{ uri: aisle.imageUrl }} style={styles.aisleImage} resizeMode="contain" /> : null}
                <Text style={[styles.aisleText, { color: theme.cardInk }]} numberOfLines={2}>{getLocalizedName(aisle)}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>
      <HeroCardLink label={t.heroShopNow} color={theme.cardInk} />
    </HeroCardFrame>
  );
}

// The festival's aisles as tiles in its own tint; the strip art is left out until a card-sized artwork exists
function PosterCard({ card }: { card: CardOf<"FESTIVE"> }) {
  const c = useStrings("common");
  const { language } = useLanguage();
  const { festival, theme } = card;
  const own = language ? festival.translations?.[language] : undefined;
  const open = (tile?: string) => router.push({ pathname: "/festival/[id]", params: tile ? { id: festival.id, tile } : { id: festival.id } });
  const tileTitle = (tile: CardOf<"FESTIVE">["festival"]["tiles"][number]) =>
    (language && (tile.translations as Record<string, { title?: string }> | null)?.[language]?.title) || tile.title;
  return (
    <HeroCardFrame theme={theme} onPress={() => open()} label={own?.title || festival.title}>
      <HeroCardHead theme={theme} kicker={own?.kicker || festival.kicker || undefined} title={own?.title || festival.title} />
      {/* Rows of two share the card's free height, so the tiles grow to fill it */}
      <View style={styles.tiles}>
        {pairs(festival.tiles.slice(0, FESTIVAL_TILES)).map((row) => (
          <View key={row[0].id} style={styles.tileRow}>
            {row.map((tile) => (
              <Pressable
                key={tile.id} style={[styles.festTile, { backgroundColor: theme.tint }]} onPress={() => open(tile.id)}
                accessibilityRole="link" accessibilityLabel={tileTitle(tile)}
              >
                <Image source={{ uri: tile.imageUrl }} style={styles.festTileImage} resizeMode="contain" />
                <Text style={styles.festTileText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{tileTitle(tile)}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>
      <HeroCardLink label={c.seeAll} color={theme.cardInk} />
    </HeroCardFrame>
  );
}

const DAY_PART_ICONS: Record<DayPart, keyof typeof Ionicons.glyphMap> = {
  morning: "sunny", afternoon: "cafe", evening: "restaurant", night: "moon",
};

/** The collection the store set for this part of the day, as product rows; "View all" opens the collection */
function RightNowCard({ card }: { card: CardOf<"RIGHT_NOW"> }) {
  const t = useStrings("home");
  const c = useStrings("common");
  const { language } = useLanguage();
  const { collection, theme } = card;
  const localized = language ? (collection.translations as Record<string, { title?: string }> | null)?.[language] : undefined;
  const badge = (
    <View style={[styles.dayPart, { backgroundColor: theme.cardInk }]}>
      <Ionicons name={DAY_PART_ICONS[card.dayPart]} size={22} color={colors.accent} />
    </View>
  );
  return (
    <ProductListCard
      card={card} title={localized?.title || collection.title} subtitle={t.heroRightNow[card.dayPart]} badge={badge}
      link={c.viewAll} onPress={() => openCollection(collection.id)}
    />
  );
}

export const HeroCardBody = memo(function HeroCardBody({ card }: { card: Card }) {
  switch (card.kind) {
    case "BUY_GET": return <BuyGetCard card={card} />;
    case "MOST_BOUGHT": return <MostBoughtCard card={card} />;
    case "STORE_SPECIAL": return <StoreSpecialCard card={card} />;
    case "FESTIVE": return <PosterCard card={card} />;
    case "RIGHT_NOW": return <RightNowCard card={card} />;
  }
});

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },
  badge: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#fde68a", transform: [{ rotate: "-8deg" }],
  },
  badgeText: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.accentText, letterSpacing: -0.5 },
  band: {
    flexDirection: "row", alignItems: "center", gap: 10, margin: -HERO_CARD_PADDING, marginBottom: 0,
    paddingHorizontal: HERO_CARD_PADDING, paddingVertical: 12,
  },
  bandText: { flex: 1 },
  bandTitle: { fontFamily: fonts.extrabold, fontSize: 20, letterSpacing: -0.3 },
  bandSubtitle: { fontFamily: fonts.semibold, fontSize: 12, marginTop: 2, opacity: 0.8 },
  lines: { flex: 1, gap: 6, paddingVertical: 10 },
  photo: { height: 150, margin: -HERO_CARD_PADDING, marginBottom: 0, backgroundColor: "rgba(255,255,255,0.5)" },
  photoTall: { height: 206 },
  photoImage: { width: "100%", height: "100%" },
  onlyHere: {
    position: "absolute", top: 12, left: 12, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  onlyHereText: { fontFamily: fonts.extrabold, fontSize: 10.5, letterSpacing: 0.8, textTransform: "uppercase" },
  copy: { paddingTop: 12 },
  dayPart: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  aisles: { flex: 1, gap: 8, paddingVertical: 12 },
  aisle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, padding: 8 },
  aisleImage: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.surface },
  aisleText: { flex: 1, fontFamily: fonts.bold, fontSize: 12, lineHeight: 15 },
  tiles: { flex: 1, gap: 8, marginBottom: 12 },
  tileRow: { flex: 1, flexDirection: "row", gap: 8 },
  festTile: { flex: 1, borderRadius: 14, padding: 6, alignItems: "center" },
  festTileImage: { width: "100%", flex: 1 },
  festTileText: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.text, marginTop: 2 },
});
