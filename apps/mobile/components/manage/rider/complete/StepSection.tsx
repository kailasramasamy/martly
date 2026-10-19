import type { ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../../constants/theme";
import { manage, tabular } from "../../ui/tokens";

interface StepSectionProps {
  number: number;
  title: string;
  hint?: string;
  /** Ticks the step once the rider has done what it asks */
  done?: boolean;
  last?: boolean;
  children: ReactNode;
}

/** One numbered step on the delivery rail: a circle and line on the left, the work on the right */
export function StepSection({ number, title, hint, done, last, children }: StepSectionProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <View style={[styles.dot, done && styles.dotDone]}>
          {done ? <Ionicons name="checkmark" size={18} color="#fff" /> : <Text style={[styles.number, tabular]}>{number}</Text>}
        </View>
        {!last && <View style={styles.line} />}
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        <View style={styles.content}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12 },
  rail: { width: 32, alignItems: "center" },
  dot: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.text },
  dotDone: { backgroundColor: colors.primary },
  number: { fontFamily: fonts.extrabold, fontSize: 15, color: "#fff" },
  line: { flex: 1, width: 2, marginVertical: 6, backgroundColor: manage.line },
  body: { flex: 1, paddingBottom: 28 },
  title: { fontFamily: fonts.extrabold, fontSize: 19, color: colors.text, lineHeight: 32 },
  hint: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.textSecondary, marginTop: 2 },
  content: { marginTop: 12, gap: 10 },
});
