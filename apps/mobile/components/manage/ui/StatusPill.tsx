import { View, Text, StyleSheet } from "react-native";
import { fonts } from "../../../constants/theme";

interface StatusPillProps {
  label: string;
  color: string;
  bg: string;
  /** Leading dot, used for live states */
  dot?: boolean;
}

export function StatusPill({ label, color, bg, dot }: StatusPillProps) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      {dot && <View style={[styles.dot, { backgroundColor: color }]} />}
      <Text style={[styles.text, { color }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: 8, height: 22, borderRadius: 11 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.2 },
});
