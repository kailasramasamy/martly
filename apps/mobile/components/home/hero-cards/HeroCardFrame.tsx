import type { ReactNode } from "react";
import { Dimensions, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { HeroCardTheme } from "@martly/shared/constants";
import { colors, fonts } from "../../../constants/theme";
import { useLanguage } from "../../../lib/language-context";
import { useProductActions } from "../../../lib/product-actions";
import { cardDeal } from "../../../lib/deal";
import type { StoreProduct } from "../../../lib/types";
import { CompactControl } from "../../CompactProductCard";

const SCREEN_WIDTH = Dimensions.get("window").width;
/** A card fills most of the screen, the next and previous ones peeking in at the sides */
export const HERO_CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.73);
export const HERO_CARD_HEIGHT = 380;
export const HERO_CARD_GAP = 12;
export const HERO_CARD_PADDING = 14;

export function HeroCardFrame({ theme, onPress, label, children }: {
  theme: HeroCardTheme; onPress?: () => void; label?: string; children: ReactNode;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, { backgroundColor: theme.card }, pressed && onPress ? styles.pressed : null]}
      onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? "link" : undefined} accessibilityLabel={label}
    >
      {children}
    </Pressable>
  );
}

export function HeroCardHead({ theme, kicker, title, subtitle, badge }: {
  theme: HeroCardTheme; kicker?: string; title: string; subtitle?: string | null; badge?: ReactNode;
}) {
  return (
    <View style={styles.head} accessibilityRole="header">
      {badge}
      <View style={styles.headText}>
        {kicker ? <Text style={[styles.kicker, { color: theme.cardInk }]} numberOfLines={1}>{kicker}</Text> : null}
        <Text style={[styles.title, { color: theme.cardInk }]} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: theme.cardInk }]} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

/** The card's last row: a strip across its full width, shaded in the card's ink */
export function HeroCardLink({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.link, { backgroundColor: `${color}14` }]}>
      <Text style={[styles.linkText, { color }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={15} color={color} />
    </View>
  );
}

function useCartControl(item: StoreProduct) {
  const actions = useProductActions();
  return {
    quantity: actions.cartQuantityMap.get(item.id) ?? 0,
    deal: cardDeal(item, actions.isMember),
    control: { onAddToCart: actions.addToCart, onUpdateQuantity: actions.updateQuantity, onShowVariants: () => actions.showVariants([item]) },
  };
}

/** One product straight on the card: white photo tile, name over size and offer (just "1+1", which fits beside a Tamil size), ADD, then the price column */
export function HeroProductLine({ item, ink }: { item: StoreProduct; ink: string }) {
  const { getLocalizedName } = useLanguage();
  const { quantity, deal, control } = useCartControl(item);
  const uri = item.product.imageUrl || item.variant.imageUrl;
  const offer = item.pricing?.offer;
  return (
    <View style={styles.line}>
      <View style={styles.lineImage}>{uri ? <Image source={{ uri }} style={styles.image} resizeMode="contain" /> : null}</View>
      <View style={styles.lineText}>
        <Text style={styles.name} numberOfLines={2}>{getLocalizedName(item.product)}</Text>
        <Text style={styles.unit} numberOfLines={1}>
          {item.variant.name}
          {offer ? <Text style={[styles.offer, { color: ink }]}>{` \u00B7 ${offer.buy}+${offer.get}`}</Text> : null}
        </Text>
      </View>
      <CompactControl item={item} quantity={quantity} outOfStock={item.availableStock <= 0} options={1} {...control} />
      <View style={styles.priceColumn}>
        {deal.struck != null && <Text style={styles.mrp}>{"\u20B9"}{deal.struck.toFixed(0)}</Text>}
        <Text style={styles.price}>{"\u20B9"}{deal.shown.toFixed(0)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: HERO_CARD_WIDTH, height: HERO_CARD_HEIGHT, borderRadius: 22, padding: HERO_CARD_PADDING, overflow: "hidden" },
  pressed: { opacity: 0.92 },
  head: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  headText: { flex: 1 },
  kicker: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, opacity: 0.8, textTransform: "uppercase", marginBottom: 2 },
  title: { fontFamily: fonts.extrabold, fontSize: 20, lineHeight: 24, letterSpacing: -0.3 },
  subtitle: { fontFamily: fonts.semibold, fontSize: 12, marginTop: 3, opacity: 0.8 },
  link: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2, height: 44,
    marginTop: "auto", marginHorizontal: -HERO_CARD_PADDING, marginBottom: -HERO_CARD_PADDING,
  },
  linkText: { fontFamily: fonts.extrabold, fontSize: 13 },
  line: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  lineImage: { width: 52, height: 52, borderRadius: 12, backgroundColor: colors.surface, padding: 4 },
  image: { width: "100%", height: "100%", mixBlendMode: "multiply" },
  lineText: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 16, color: colors.text },
  unit: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.textSecondary },
  offer: { fontFamily: fonts.bold },
  priceColumn: { minWidth: 34, alignItems: "flex-end" },
  mrp: { fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary, textDecorationLine: "line-through" },
  price: { fontFamily: fonts.extrabold, fontSize: 13, color: colors.text },
});
