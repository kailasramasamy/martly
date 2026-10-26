import { memo } from "react";
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { SystemSection } from "@martly/shared/types";
import { fonts } from "../../../../constants/theme";
import { useLanguage } from "../../../../lib/language-context";
import { getBestPrice } from "../../../../lib/membership-context";
import { useProductActions } from "../../../../lib/product-actions";
import { useStore } from "../../../../lib/store-context";
import { useStrings } from "../../../../lib/i18n/use-strings";
import type { StoreProduct, StorePost } from "../../../../lib/types";
import { AddButton } from "../../../store-voice/AddButton";
import { KIND_THEME, OwnerAvatar, usePostTime, useVoiceText } from "../../../store-voice/voice";

// `moreProducts`: the post's products past the first three, which the row scrolls to
interface Teaser { post: StorePost & { moreProducts?: StoreProduct[] }; more: number; logoUrl: string | null }
type Theme = (typeof KIND_THEME)[StorePost["kind"]];

const openBoard = () => router.push("/store-posts");
const TILE_WIDTH = 96;
// The band's photo stack: each pack in a white disc, fanned and overlapping
const FAN = [{ right: 80, top: 24, rotate: "-10deg" }, { right: 40, top: 4, rotate: "6deg" }, { right: 0, top: 28, rotate: "14deg" }];

function Tile({ sp, theme }: { sp: StoreProduct; theme: Theme }) {
  const { getLocalizedName } = useLanguage();
  const { isMember, storeId, cartQuantityMap } = useProductActions();
  const image = sp.product.imageUrl ?? sp.variant.imageUrl;
  const price = `₹${Math.round(getBestPrice(sp, isMember))}`;
  // In the cart the stepper needs the whole foot, so the price moves up beside the size
  const inCart = (cartQuantityMap.get(sp.id) ?? 0) > 0;
  return (
    <View style={styles.tile}>
      <TouchableOpacity
        style={styles.photo} accessibilityRole="button" accessibilityLabel={getLocalizedName(sp.product)}
        onPress={() => router.push({ pathname: "/product/[id]", params: storeId ? { id: sp.product.id, storeId } : { id: sp.product.id } })}
      >
        {image && <Image source={{ uri: image }} style={styles.photoImg} />}
      </TouchableOpacity>
      <Text style={styles.tileName} numberOfLines={2}>{getLocalizedName(sp.product)}</Text>
      <Text style={styles.tileSize} numberOfLines={1}>
        {sp.variant.name}
        {inCart && <Text style={[styles.sizePrice, { color: theme.ink }]}>{` · ${price}`}</Text>}
      </Text>
      <View style={styles.tileFoot}>
        {!inCart && <Text style={[styles.price, { color: theme.ink }]}>{price}</Text>}
        <View style={inCart ? styles.fullStep : undefined}><AddButton sp={sp} tint={theme.accent} fill={inCart} /></View>
      </View>
    </View>
  );
}

// The coloured band: what kind of news, when, at which shop, with the products fanned on the right
function Band({ post, theme }: { post: StorePost; theme: Theme }) {
  const t = useStrings("storeVoice");
  const when = usePostTime();
  const { getLocalizedName } = useLanguage();
  const { selectedStore } = useStore();
  const photos = post.products.flatMap((sp) => sp.product.imageUrl ?? sp.variant.imageUrl ?? []).slice(0, FAN.length);
  return (
    <TouchableOpacity style={[styles.band, { backgroundColor: theme.accent }]} onPress={openBoard} activeOpacity={0.9} accessibilityRole="button">
      <Ionicons name={theme.icon} size={150} color="rgba(255,255,255,0.12)" style={styles.watermark} />
      <View style={styles.bandText}>
        <Text style={styles.kicker}>{`${t.kind[post.kind]} · ${when(post.createdAt).toUpperCase()}`}</Text>
        <Text style={styles.headline} numberOfLines={1}>{t.headline[post.kind]}</Text>
        {selectedStore && <Text style={styles.atStore} numberOfLines={1}>{t.atStore(getLocalizedName(selectedStore))}</Text>}
      </View>
      <View style={styles.fan}>
        {photos.map((uri, i) => (
          <View key={uri} style={[styles.disc, { right: FAN[i].right, top: FAN[i].top, transform: [{ rotate: FAN[i].rotate }] }]}>
            <Image source={{ uri }} style={styles.discImg} />
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
}

/** The owner's newest post on Home: a bold band in its kind's colour, the owner's words, and its products to add */
export const StorePostsSection = memo(function StorePostsSection({ section }: { section: SystemSection }) {
  const t = useStrings("storeVoice");
  const voice = useVoiceText();
  const { post, more, logoUrl } = section.data as unknown as Teaser;
  const theme = KIND_THEME[post.kind];
  const products = [...post.products, ...(post.moreProducts ?? [])];
  return (
    <View style={styles.wrap}>
      <View style={[styles.card, { backgroundColor: theme.ground }]}>
        <Band post={post} theme={theme} />
        <View style={styles.body}>
          <View style={styles.owner}>
            <View style={styles.ring}><OwnerAvatar name={post.author} logoUrl={logoUrl} size={44} /></View>
            <Text style={[styles.ownerName, { color: theme.ink }]} numberOfLines={1}>{t.saidBy(post.author)}</Text>
          </View>
          <Text style={styles.quote}>{voice(post)}</Text>
          {products.length > 0 && (
            <FlatList
              horizontal data={products} keyExtractor={(sp) => sp.id} renderItem={({ item }) => <Tile sp={item} theme={theme} />}
              showsHorizontalScrollIndicator={false} style={styles.row} contentContainerStyle={styles.tiles}
            />
          )}
          {more > 0 && (
            <TouchableOpacity style={styles.more} onPress={openBoard} accessibilityRole="button">
              <Text style={[styles.moreText, { color: theme.ink }]}>{t.moreThisWeek(more)}</Text>
              <Ionicons name="arrow-forward" size={16} color={theme.ink} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 14 },
  card: { borderRadius: 22, overflow: "hidden" },
  band: { height: 118, paddingHorizontal: 16, paddingTop: 16, flexDirection: "row", overflow: "hidden" },
  watermark: { position: "absolute", left: -18, bottom: -46 },
  bandText: { flex: 1, minWidth: 0, gap: 2 },
  kicker: { fontFamily: fonts.extrabold, fontSize: 11, letterSpacing: 0.6, color: "rgba(255,255,255,0.85)" },
  headline: { fontFamily: fonts.extrabold, fontSize: 26, lineHeight: 32, color: "#ffffff" },
  atStore: { fontFamily: fonts.bold, fontSize: 13, color: "rgba(255,255,255,0.9)" },
  fan: { width: 150, height: 104 },
  disc: {
    position: "absolute", width: 70, height: 70, borderRadius: 35, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center",
    shadowColor: "#0f172a", shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  // A square photo's corners stay inside the disc: its diagonal (48 × 1.41 ≈ 68) is under the disc's 70
  discImg: { width: 48, height: 48, resizeMode: "contain" },
  body: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  // The avatar sits half over the band, as if the owner leaned in from the shop
  owner: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: -22 },
  ring: { borderRadius: 26, borderWidth: 3, borderColor: "#ffffff", backgroundColor: "#ffffff" },
  ownerName: { flex: 1, fontFamily: fonts.extrabold, fontSize: 13, paddingBottom: 4 },
  quote: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 23, color: "#0f172a" },
  // The row runs to the card's edges, so a fourth tile peeks in to show it scrolls
  row: { marginHorizontal: -14 },
  tiles: { gap: 8, paddingHorizontal: 14 },
  tile: { width: TILE_WIDTH, borderRadius: 14, backgroundColor: "#ffffff", padding: 8, gap: 1 },
  // A shorter photo makes room for a two-line name, keeping the tile as tall as before
  photo: { height: 68, alignItems: "center", justifyContent: "center" },
  photoImg: { width: 64, height: 64, resizeMode: "contain" },
  tileName: { fontFamily: fonts.bold, fontSize: 12.5, lineHeight: 16, height: 32, color: "#0f172a" },
  tileSize: { fontFamily: fonts.medium, fontSize: 11.5, color: "#64748b" },
  tileFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  price: { fontFamily: fonts.extrabold, fontSize: 14 },
  sizePrice: { fontFamily: fonts.extrabold },
  fullStep: { flex: 1 },
  more: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 44, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.75)" },
  moreText: { fontFamily: fonts.extrabold, fontSize: 13.5 },
});
