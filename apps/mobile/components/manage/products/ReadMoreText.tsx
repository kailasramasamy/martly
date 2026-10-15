import { useState } from "react";
import { Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, fonts } from "../../../constants/theme";

/** Left-aligned paragraph clamped to a few lines, with a toggle when there's more */
export function ReadMoreText({ text, lines = 4 }: { text: string; lines?: number }) {
  const [expanded, setExpanded] = useState(false);
  // Measured from the unclamped first layout — once clamped, iOS only reports the visible lines
  const [clamped, setClamped] = useState<boolean | null>(null);
  return (
    <>
      <Text
        style={styles.body}
        numberOfLines={clamped && !expanded ? lines : undefined}
        onTextLayout={(e) => clamped === null && setClamped(e.nativeEvent.lines.length > lines)}
        selectable
      >
        {text.trim()}
      </Text>
      {(clamped || expanded) && (
        <TouchableOpacity onPress={() => setExpanded((v) => !v)} hitSlop={10} accessibilityRole="button">
          <Text style={styles.toggle}>{expanded ? "Show less" : "Read more"}</Text>
        </TouchableOpacity>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: fonts.medium, fontSize: 14.5, lineHeight: 22, color: colors.text },
  toggle: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.primary, marginTop: 6 },
});
