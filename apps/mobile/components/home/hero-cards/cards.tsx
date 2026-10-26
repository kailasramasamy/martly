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
// A store special shows the same rows as the other product cards, each product once
const SPECIAL_PRODUCTS = 4;

const pairs = <T,>(items: T[]) => items.flatMap((item, i) => (i % 2 === 0 ? [items.slice(i, i + 2)] : []));
type CardOf<K extends Card["kind"]> = Extract<Card, { kind: K }>;

/** A product list card: a lighter band with the title (and a badge where artwork would sit), then rows of products */
function ProductListCard({ theme, products, title, subtitle, badge, link, onPress }: {
  theme: Card["theme"]; products: StoreProduct[]; title: string; subtitle: string; badge?: ReactNode; link?: string; onPress?: () => void;
}) {
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
        {products.map((p) => <HeroProductLine key={p.id} item={p} ink={theme.cardInk} />)}
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
      theme={card.theme} products={card.products} title={t.buyGetTitle} subtitle={t.buyGetCount(card.total)} link={c.viewAll} onPress={() => router.push("/buy-get")}
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
      theme={card.theme} products={card.products} title={t.heroMostBought} subtitle={t.heroMostBoughtSub(getLocalizedName(store))} link={c.viewAll}
      onPress={() => router.push("/most-bought")}
    />
  );
}

/** The store's own range as product rows, its photo (or a shop badge) where the other cards put theirs; "Shop now" opens it */
function StoreSpecialCard({ card }: { card: CardOf<"STORE_SPECIAL"> }) {
  const t = useStrings("home");
  const { language } = useLanguage();
  const { collection, theme } = card;
  const localized = language ? (collection.translations as Record<string, { title?: string; subtitle?: string }> | null)?.[language] : undefined;
  const imageUrl = (language && collection.imageUrls?.[language]) || collection.imageUrl;
  // Every size comes back; a row is a product, in its first size
  const products = collection.products.filter((sp, i, all) => all.findIndex((o) => o.product.id === sp.product.id) === i).slice(0, SPECIAL_PRODUCTS);
  const badge = imageUrl
    ? <Image source={{ uri: imageUrl }} style={styles.specialPhoto} />
    : <View style={[styles.dayPart, { backgroundColor: theme.cardInk }]}><Ionicons name="storefront" size={20} color={colors.accent} /></View>;
  return (
    <ProductListCard
      theme={theme} products={products} title={localized?.title || collection.title}
      subtitle={localized?.subtitle || collection.subtitle || t.heroOnlyHere} badge={badge}
      link={t.heroShopNow} onPress={() => openCollection(collection.id)}
    />
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
                key={tile.id} style={[styles.festTile, { backgroundColor: "rgba(255,255,255,0.7)" }]} onPress={() => open(tile.id)}
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
      theme={card.theme} products={card.products} title={localized?.title || collection.title} subtitle={t.heroRightNow[card.dayPart]} badge={badge}
      link={c.viewAll} onPress={() => openCollection(collection.id)}
    />
  );
}

/** A collection the admin put in the carousel, as product rows in the palette they picked; "View all" opens it */
function CollectionCard({ card }: { card: CardOf<"COLLECTION"> }) {
  const t = useStrings("home");
  const c = useStrings("common");
  const { language } = useLanguage();
  const { collection } = card;
  const localized = language ? (collection.translations as Record<string, { title?: string; subtitle?: string }> | null)?.[language] : undefined;
  return (
    <ProductListCard
      theme={card.theme} products={card.products} title={localized?.title || collection.title}
      subtitle={localized?.subtitle || collection.subtitle || t.heroCollectionCount(card.total)}
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
    case "COLLECTION": return <CollectionCard card={card} />;
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
  specialPhoto: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: colors.surface },
  dayPart: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  tiles: { flex: 1, gap: 8, marginBottom: 12 },
  tileRow: { flex: 1, flexDirection: "row", gap: 8 },
  festTile: { flex: 1, borderRadius: 14, padding: 6, alignItems: "center" },
  festTileImage: { width: "100%", flex: 1 },
  festTileText: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.text, marginTop: 2 },
});
