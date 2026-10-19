import { memo, useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fonts } from "../../../../constants/theme";

export const STAMP_SIZE = 70;
const SHIMMER_WIDTH = 26;
const SHIMMER_MS = 1100;
const SHIMMER_REST_MS = 2600;
const SHINE = ["#ffffff00", "#ffffffcc", "#ffffff00"] as const;

/** "Flat 20% OFF" → a small lead line and a big figure, so the number carries the stamp; other offers stay whole */
function splitOffer(label: string) {
  const match = label.match(/^(.*?)((?:\u20B9\s*\d+|\d+\s*%)\s*(?:off)?)(.*)$/i);
  if (!match || match[3].trim()) return { lead: null, figure: label };
  return { lead: match[1].trim() || null, figure: match[2].trim() };
}

/** The offer, struck like a rubber stamp over the ticket's tear line, with a glint passing across it now and then */
export const OfferStamp = memo(function OfferStamp({ label }: { label: string }) {
  const glint = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const sweep = Animated.loop(Animated.sequence([
      Animated.timing(glint, { toValue: 1, duration: SHIMMER_MS, useNativeDriver: true }),
      Animated.delay(SHIMMER_REST_MS),
      Animated.timing(glint, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    sweep.start();
    return () => sweep.stop();
  }, [glint]);
  const translateX = glint.interpolate({ inputRange: [0, 1], outputRange: [-STAMP_SIZE, STAMP_SIZE] });
  const { lead, figure } = splitOffer(label);

  return (
    <View style={styles.stamp} accessibilityLabel={label}>
      <View style={styles.face}>
        <View style={styles.ring}>
          {lead ? <Text style={styles.lead} numberOfLines={1}>{lead.toUpperCase()}</Text> : null}
          <Text style={styles.figure} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>{figure.toUpperCase()}</Text>
        </View>
        <Animated.View style={[styles.shine, { transform: [{ translateX }, { rotate: "20deg" }] }]} pointerEvents="none">
          <LinearGradient colors={SHINE} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  // The shadow lives outside the clipped face, since iOS drops shadows on views that clip
  stamp: {
    width: STAMP_SIZE, height: STAMP_SIZE, borderRadius: STAMP_SIZE / 2, backgroundColor: colors.salePill,
    transform: [{ rotate: "-10deg" }],
    shadowColor: "#78350f", shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  face: { flex: 1, borderRadius: STAMP_SIZE / 2, padding: 5, overflow: "hidden" },
  ring: {
    flex: 1, borderRadius: STAMP_SIZE / 2, borderWidth: 1.5, borderStyle: "dashed", borderColor: `${colors.salePillText}55`,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 6,
  },
  lead: { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.2, color: colors.salePillText },
  figure: { fontFamily: fonts.extrabold, fontSize: 15, lineHeight: 17, color: colors.salePillText, textAlign: "center", letterSpacing: -0.4 },
  shine: { position: "absolute", top: -12, bottom: -12, width: SHIMMER_WIDTH },
});
