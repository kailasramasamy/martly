import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius } from "../../../constants/theme";
import { COUNT_STATUS } from "./types";

interface RecountBannerProps {
  items: number;
  note: string | null;
  /** The counter sees an instruction; the approver sees what they are waiting on */
  forCounter: boolean;
}

/** Sits above the summary while a count is out for recount */
export function RecountBanner({ items, note, forCounter }: RecountBannerProps) {
  const { color, bg } = COUNT_STATUS.RECOUNT;
  return (
    <View style={[styles.card, { backgroundColor: bg }]}>
      <Ionicons name="refresh-circle" size={24} color={color} />
      <View style={styles.body}>
        <Text style={[styles.title, { color }]}>
          {forCounter ? "Recount requested" : "Waiting for recount"} {"·"} {items} {items === 1 ? "item" : "items"}
        </Text>
        {forCounter && <Text style={styles.text}>Your manager asked you to count these again.</Text>}
        {note ? <Text style={styles.text}>{note}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", gap: 10, margin: 14, marginBottom: 0, padding: 14, borderRadius: radius.lg },
  body: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.bold, fontSize: 15 },
  text: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.text },
});
