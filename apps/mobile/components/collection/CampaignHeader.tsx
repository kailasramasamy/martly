import { Dimensions, Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { fonts } from "../../constants/theme";
import { blend } from "../home/color-mix";
import { useLanguage } from "../../lib/language-context";
import type { CollectionHeader } from "../../lib/types";
import { CountdownChip } from "../home/sections/campaign/Countdown";
import { OfferStamp, STAMP_SIZE } from "../home/sections/campaign/OfferStamp";

const SCREEN_WIDTH = Dimensions.get("window").width;
const ART_WIDTH = Math.round(SCREEN_WIDTH * 0.44);
// Campaign cut-outs are about 1.6:1; a box of that shape keeps the art pinned level with the headline
const ART_HEIGHT = Math.round(ART_WIDTH / 1.6);
const HEIGHT = 150;
// The grid's side padding, which the header bleeds through so its deeper band runs edge to edge
const BLEED = 16;
// The header (and the navigation bar above it) sit a shade deeper than the page, deepened towards the campaign's own
// ink rather than black so it stays the same hue instead of turning grey
const HEADER_DEEPEN = 0.14;
// Holds the deeper shade behind the headline, then fades into the page colour above the products
const FADE_STOPS = [0, 0.62, 1] as const;

export function campaignHeaderColor(theme: { background: string; title: string }) {
  return blend(theme.background, theme.title, HEADER_DEEPEN);
}

type Campaign = NonNullable<CollectionHeader["campaign"]>;

/** The top of a campaign's own screen, matching its Home card: headline and countdown on the left, the products'
 *  cut-out on the right with the offer stamped on its corner, on a deeper shade of the campaign colour that fades
 *  into the page */
export function CampaignHeader({ collection, campaign }: { collection: CollectionHeader; campaign: Campaign }) {
  const { language } = useLanguage();
  const title = (language && collection.translations?.[language]?.title) || collection.title;
  const subtitle = (language && collection.translations?.[language]?.subtitle) || collection.subtitle;
  const { title: ink, dark } = campaign.theme;

  const deep = campaignHeaderColor(campaign.theme);

  return (
    <LinearGradient colors={[deep, deep, campaign.theme.background]} locations={FADE_STOPS} style={styles.wrap} accessibilityRole="header">
      {campaign.imageUrl ? <Image source={{ uri: campaign.imageUrl }} style={styles.art} resizeMode="contain" /> : null}
      <View style={styles.text}>
        <CountdownChip endsAt={collection.endsAt} ink={ink} fill={dark ? "#ffffff26" : "#ffffffb8"} />
        <Text style={[styles.title, { color: ink }]} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.8}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: ink }]} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {campaign.offerLabel ? <View style={styles.stamp}><OfferStamp label={campaign.offerLabel} /></View> : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: { height: HEIGHT, marginHorizontal: -BLEED, paddingHorizontal: BLEED, marginBottom: 14 },
  art: { position: "absolute", right: 0, top: 4, width: ART_WIDTH, height: ART_HEIGHT },
  text: { position: "absolute", left: BLEED, top: 2, width: "52%", gap: 4 },
  title: { fontFamily: fonts.extrabold, fontSize: 26, lineHeight: 30, letterSpacing: -0.4 },
  subtitle: { fontFamily: fonts.semibold, fontSize: 13.5, lineHeight: 18, opacity: 0.85 },
  // Pressed against the cut-out's lower left, as on the Home card
  stamp: { position: "absolute", right: ART_WIDTH - STAMP_SIZE / 2, top: ART_HEIGHT - STAMP_SIZE / 2 },
});
