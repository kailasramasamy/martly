import { StyleSheet, Text, View } from "react-native";
import type { OwnerPick } from "@martly/shared/types";
import { colors, fonts } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";
import { OwnerAvatar, useVoiceText } from "./voice";

/** On the product page: why the store's owner vouches for it, in their words and the shopper's language */
export function OwnerRecommends({ pick, storeName, logoUrl }: { pick: OwnerPick; storeName: string; logoUrl?: string | null }) {
  const t = useStrings("storeVoice");
  const voice = useVoiceText();
  return (
    <View style={styles.box}>
      <OwnerAvatar name={pick.author} logoUrl={logoUrl} />
      <View style={styles.text}>
        <Text style={styles.kicker}>{t.ownerRecommends}</Text>
        <Text style={styles.quote}>{`"${voice({ text: pick.note, language: pick.language, translations: pick.translations })}"`}</Text>
        <Text style={styles.who}>{t.ownerOf(pick.author, storeName)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: "row", gap: 12, marginTop: 14, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: "#99f6e4", backgroundColor: "#f0fdfa" },
  text: { flex: 1, gap: 4 },
  kicker: { fontFamily: fonts.extrabold, fontSize: 11.5, letterSpacing: 0.4, color: colors.primary },
  quote: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 21, color: "#134e4a" },
  who: { fontFamily: fonts.semibold, fontSize: 12.5, color: "#115e59" },
});
