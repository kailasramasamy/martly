import { memo } from "react";
import { StyleSheet, View } from "react-native";

export const NOTCH = 22;

interface Props {
  /** The page colour showing through the notches */
  cutout: string;
  /** The tear line's colour */
  line: string;
}

/** A ticket's tear line: half-circle bites at both edges joined by a dashed rule */
export const Perforation = memo(function Perforation({ cutout, line }: Props) {
  return (
    <View style={styles.row} pointerEvents="none">
      <View style={[styles.notch, styles.left, { backgroundColor: cutout }]} />
      {/* RN only dashes a whole border, so a dashed box is clipped down to one edge */}
      <View style={styles.clip}><View style={[styles.dash, { borderColor: line }]} /></View>
      <View style={[styles.notch, styles.right, { backgroundColor: cutout }]} />
    </View>
  );
});

const styles = StyleSheet.create({
  row: { height: NOTCH, flexDirection: "row", alignItems: "center" },
  notch: { position: "absolute", width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2, top: 0 },
  left: { left: -NOTCH / 2 },
  right: { right: -NOTCH / 2 },
  clip: { flex: 1, height: 1.5, overflow: "hidden", marginHorizontal: NOTCH },
  dash: { height: 4, borderWidth: 1.5, borderStyle: "dashed", borderRadius: 1 },
});
