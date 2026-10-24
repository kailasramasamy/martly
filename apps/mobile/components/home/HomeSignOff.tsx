import { Image, StyleSheet, Text, View } from "react-native";
import { fonts } from "../../constants/theme";
import { useLanguage } from "../../lib/language-context";
import { useStrings } from "../../lib/i18n/use-strings";

const WORDMARKS = {
  en: { source: require("../../assets/branding/martly-wordmark-light.png"), width: 104, height: 42 },
  ta: { source: require("../../assets/branding/martly-wordmark-ta-light.png"), width: 125, height: 42 },
};

/** The end of Home: a big quiet line and the wordmark in the shopper's language, so the scroll ends on the brand */
export function HomeSignOff() {
  const t = useStrings("home");
  const { language } = useLanguage();
  const wordmark = language === "ta" ? WORDMARKS.ta : WORDMARKS.en;
  return (
    <View style={styles.wrap} accessibilityRole="text">
      <Text style={styles.message}>{t.signOff}</Text>
      <Image
        source={wordmark.source}
        style={[styles.wordmark, { width: wordmark.width, height: wordmark.height }]}
        resizeMode="contain"
        accessibilityLabel="Martly"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 48, paddingBottom: 8, gap: 16 },
  // Faded slate, so it reads as a sign-off rather than another section asking to be tapped
  message: { fontFamily: fonts.extrabold, fontSize: 26, lineHeight: 34, color: "#cbd5e1", letterSpacing: -0.6 },
  wordmark: { opacity: 0.55 },
});
