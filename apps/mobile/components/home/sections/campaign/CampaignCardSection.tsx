import { memo, useCallback, useMemo } from "react";
import { Dimensions, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CampaignCardSection as CampaignCard, CampaignTile } from "@martly/shared/types";
import { fonts } from "../../../../constants/theme";
import { useStrings } from "../../../../lib/i18n/use-strings";
import type { StoreProduct } from "../../../../lib/types";
import { mix } from "../../color-mix";
import { openCollection, useSectionText } from "../context";
import { AisleShelf } from "./AisleShelf";
import { CountdownChip } from "./Countdown";
import { HighlightFan } from "./HighlightFan";
import { OfferStamp } from "./OfferStamp";

type Section = CampaignCard<StoreProduct>;

const CARD_WIDTH = Dimensions.get("window").width - 32;
// Campaign art is a transparent cut-out of the products, so it sits straight on the card's theme colour
const ART_WIDTH = Math.round(CARD_WIDTH * 0.48);
const TOP_HEIGHT = 168;

function useCardTones(theme: Section["theme"]) {
  return useMemo(() => ({
    rim: `${mix(theme.background, 0, 0.18)}66`,
    chip: theme.dark ? "#ffffff26" : "#ffffffb8",
  }), [theme.background, theme.dark]);
}

function Headline({ section, tones, onPress }: { section: Section; tones: ReturnType<typeof useCardTones>; onPress: () => void }) {
  const t = useStrings("home");
  const { title, subtitle } = useSectionText(section);
  const ink = section.theme.title;
  const ctaInk = section.theme.dark ? "#0f172a" : "#ffffff";
  return (
    <View style={styles.headline}>
      <CountdownChip endsAt={section.endsAt} ink={ink} fill={tones.chip} />
      <Text style={[styles.title, { color: ink }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: ink }]} numberOfLines={2}>{subtitle}</Text> : null}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [styles.cta, { backgroundColor: ink }, pressed && styles.ctaPressed]}
      >
        <Text style={[styles.ctaText, { color: ctaInk }]}>
          {section.productCount > 0 ? t.shopAllCount(section.productCount) : t.shopNow}
        </Text>
        <Ionicons name="arrow-forward" size={14} color={ctaInk} />
      </Pressable>
    </View>
  );
}

/**
 * A promotion as one compact card on its theme colour: the headline and a "Shop all" pill on the left, a cut-out of
 * the products on the right with the offer stamped beside it, and the aisles below as tiles that open the collection
 * narrowed to that aisle.
 */
export const CampaignCardSection = memo(function CampaignCardSection({ section }: { section: Section }) {
  const t = useStrings("home");
  const tones = useCardTones(section.theme);
  const { title, translated } = useSectionText(section);
  const offerLabel = translated?.offerLabel || section.offerLabel;
  const { collectionId } = section;
  const openAll = useCallback(() => openCollection(collectionId), [collectionId]);
  const openTile = useCallback((tile: CampaignTile) => openCollection(collectionId, tile.subcategoryIds), [collectionId]);

  return (
    <View style={styles.wrap}>
      <View style={[styles.card, { backgroundColor: section.theme.background, borderColor: tones.rim }]}>
        <Pressable
          onPress={openAll}
          accessibilityRole="button"
          accessibilityLabel={`${title ?? t.campaign}. ${offerLabel ?? ""}`}
          style={styles.top}
        >
          {section.imageUrl ? (
            <Image source={{ uri: section.imageUrl }} style={styles.art} resizeMode="contain" />
          ) : (
            <View style={styles.fan}><HighlightFan products={section.highlights} edge={tones.rim} /></View>
          )}
          <Headline section={section} tones={tones} onPress={openAll} />
          {offerLabel ? <View style={styles.stamp}><OfferStamp label={offerLabel} /></View> : null}
        </Pressable>
        {section.tiles.length > 0 && (
          <View style={styles.aisles}>
            <AisleShelf tiles={section.tiles} rim={tones.rim} onTile={openTile} />
          </View>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { marginTop: 20, marginHorizontal: 16 },
  card: { borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  // A floor, not a fixed height: a headline that wraps further (Tamil runs longer) grows the card instead of
  // running into the aisles
  top: { minHeight: TOP_HEIGHT },
  art: { position: "absolute", right: 0, top: 18, bottom: 14, width: ART_WIDTH },
  fan: { position: "absolute", right: 8, top: 12 },
  headline: { marginLeft: 16, marginTop: 16, marginBottom: 12, width: "50%", gap: 4 },
  title: { fontFamily: fonts.extrabold, fontSize: 24, lineHeight: 28, letterSpacing: -0.4 },
  subtitle: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 17, opacity: 0.85 },
  cta: {
    flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, marginTop: 8,
    minHeight: 34, paddingHorizontal: 14, borderRadius: 17,
  },
  ctaPressed: { opacity: 0.88 },
  ctaText: { fontFamily: fonts.extrabold, fontSize: 13 },
  // Pressed against the cut-out's lower left, between the headline and the products
  stamp: { position: "absolute", left: "48%", bottom: 2 },
  aisles: { paddingTop: 4, paddingBottom: 12 },
});
