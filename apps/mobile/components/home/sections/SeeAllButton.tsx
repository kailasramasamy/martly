import { memo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../constants/theme";
import { useStrings } from "../../../lib/i18n/use-strings";

interface Props {
  onPress: () => void;
  /** e.g. "See all 48 products"; defaults to "See all" */
  label?: string;
  /** A few product images stacked before the label, a preview of what it opens */
  thumbs?: string[];
}

/** Full-width pill under a section that opens everything behind it */
export const SeeAllButton = memo(function SeeAllButton({ onPress, label, thumbs }: Props) {
  const c = useStrings("common");
  const text = label ?? c.seeAll;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={text}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
    >
      {thumbs && thumbs.length > 0 && (
        <View style={styles.thumbs}>
          {thumbs.map((uri, i) => (
            <View key={uri} style={[styles.thumb, i > 0 && styles.thumbStacked]}>
              <Image source={{ uri }} style={styles.thumbImage} resizeMode="contain" />
            </View>
          ))}
        </View>
      )}
      <Text style={styles.text}>{text}</Text>
      <Ionicons name="caret-forward" size={11} color={colors.primary} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    marginHorizontal: 16, marginTop: 6, minHeight: 44, borderRadius: 22,
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
  },
  pressed: { backgroundColor: colors.surface },
  text: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary },
  thumbs: { flexDirection: "row", marginRight: 4 },
  thumb: {
    width: 28, height: 28, borderRadius: 14, padding: 3, backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border, overflow: "hidden",
  },
  thumbStacked: { marginLeft: -10 },
  thumbImage: { width: "100%", height: "100%" },
});
