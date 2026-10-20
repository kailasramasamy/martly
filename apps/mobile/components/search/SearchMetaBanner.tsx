import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, spacing } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";
import type { SearchMeta } from "../../lib/types";

interface SearchMetaBannerProps {
  meta: SearchMeta;
  typed: string;
  onSearchInstead: () => void;
}

// Says when we searched something other than what was typed; a spelling fix can be undone in one tap
export function SearchMetaBanner({ meta, typed, onSearchInstead }: SearchMetaBannerProps) {
  const t = useStrings("search");
  const shown = meta.correctedQuery ?? meta.expandedTerms?.join(", ") ?? t.similarProducts;
  return (
    <View style={styles.banner}>
      <Ionicons name={meta.correctedQuery ? "color-wand-outline" : "sparkles-outline"} size={14} color={colors.primary} />
      <View style={styles.body}>
        <Text style={styles.text}>
          {t.showingResultsFor}<Text style={styles.bold}>{shown}</Text>{t.showingResultsForAfter}
        </Text>
        {meta.correctedQuery ? (
          <TouchableOpacity onPress={onSearchInstead} accessibilityRole="button" hitSlop={{ top: 10, bottom: 10 }}>
            <Text style={styles.text}>
              {t.searchInsteadFor}<Text style={styles.link}>{typed}</Text>{t.searchInsteadForAfter}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    marginHorizontal: spacing.md, marginBottom: spacing.sm, paddingHorizontal: spacing.sm + 2, paddingVertical: 8,
    backgroundColor: "#f0fdfa", borderRadius: 10, borderWidth: 1, borderColor: "#ccfbf1",
  },
  body: { flex: 1, gap: 3 },
  text: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  bold: { fontFamily: fonts.bold, color: colors.text },
  link: { fontFamily: fonts.bold, color: colors.primary, textDecorationLine: "underline" },
});
