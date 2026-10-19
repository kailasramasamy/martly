import { memo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { SectionHeaderStyle } from "@martly/shared/constants";
import { colors, fonts } from "../../../constants/theme";

const H_PADDING = 16;
const BANNER_TINT = "#ccfbf1";
const BANNER_ART = 76;
const ARTWORK_ASPECT = 3;

interface Props {
  title: string | null;
  subtitle: string | null;
  look?: SectionHeaderStyle;
  imageUrl?: string | null;
  tint?: string | null;
}

/** Plain: a bold title running into a dashed rule */
function PlainHeader({ title, subtitle }: Props) {
  return (
    <View style={styles.plain} accessibilityRole="header">
      <View style={styles.plainRow}>
        <Text style={styles.plainTitle} numberOfLines={1}>{title}</Text>
        {/* RN only dashes a whole border, so a dashed box is clipped down to its top edge */}
        <View style={styles.ruleClip}><View style={styles.rule} /></View>
      </View>
      {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
    </View>
  );
}

/** Banner: title and subtitle on a tinted strip, the section's art tucked in on the right */
function BannerHeader({ title, subtitle, imageUrl, tint }: Props) {
  const base = tint ?? BANNER_TINT;
  return (
    <LinearGradient colors={[base, `${base}55`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.banner}>
      <View style={styles.bannerText} accessibilityRole="header">
        <Text style={styles.bannerTitle} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.bannerArt} resizeMode="contain" /> : null}
    </LinearGradient>
  );
}

/** Artwork: an optional header image over a large display title on a soft tint, like a magazine section opener */
function ArtworkHeader({ title, subtitle, imageUrl, tint }: Props) {
  return (
    <View style={[styles.artwork, tint ? { backgroundColor: tint } : null]} accessibilityRole="header">
      {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.artworkImage} resizeMode="cover" /> : null}
      <Text style={styles.artworkTitle} numberOfLines={2}>{title}</Text>
      {subtitle ? <Text style={styles.artworkSubtitle} numberOfLines={2}>{subtitle}</Text> : null}
    </View>
  );
}

export const SectionHeader = memo(function SectionHeader(props: Props) {
  if (!props.title) return null;
  if (props.look === "BANNER") return <BannerHeader {...props} />;
  if (props.look === "ARTWORK") return <ArtworkHeader {...props} />;
  return <PlainHeader {...props} />;
});

const styles = StyleSheet.create({
  plain: { paddingHorizontal: H_PADDING, marginBottom: 12 },
  plainRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  plainTitle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.text, letterSpacing: -0.3, flexShrink: 1 },
  ruleClip: { flex: 1, height: 1, overflow: "hidden", marginTop: 2 },
  rule: { height: 2, borderWidth: 1, borderColor: colors.border, borderStyle: "dashed", borderRadius: 1 },
  subtitle: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  banner: {
    flexDirection: "row", alignItems: "center", marginHorizontal: H_PADDING, marginBottom: 12,
    borderRadius: 12, paddingLeft: 16, minHeight: BANNER_ART + 8, overflow: "hidden",
  },
  bannerText: { flex: 1, paddingVertical: 12 },
  bannerTitle: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.text, letterSpacing: -0.2 },
  bannerArt: { width: BANNER_ART, height: BANNER_ART, marginRight: 8 },
  artwork: { marginHorizontal: H_PADDING, marginBottom: 14, padding: 8, paddingBottom: 14, borderRadius: 16, alignItems: "center" },
  artworkImage: { width: "100%", aspectRatio: ARTWORK_ASPECT, borderRadius: 12, marginBottom: 12 },
  artworkTitle: {
    fontFamily: fonts.extrabold, fontSize: 24, lineHeight: 30, letterSpacing: -0.3,
    color: colors.primaryDark, textAlign: "center",
  },
  artworkSubtitle: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 4, textAlign: "center" },
});
