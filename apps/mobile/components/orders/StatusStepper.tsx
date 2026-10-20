import { Fragment } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";

const DOT = 20;

interface Props {
  steps: string[];
  current: number;
}

/** Placed → … → Delivered, with done steps ticked and the current one ringed */
export function StatusStepper({ steps, current }: Props) {
  const t = useStrings("orders");
  return (
    <View style={styles.wrap} accessibilityLabel={t.status.stepOf(current + 1, steps.length, steps[current])}>
      <View style={styles.track}>
        {steps.map((step, i) => (
          <Fragment key={step}>
            {i > 0 && <View style={[styles.line, i <= current && styles.lineDone]} />}
            <View style={[styles.dot, i < current && styles.dotDone, i === current && styles.dotCurrent]}>
              {i < current && <Ionicons name="checkmark" size={12} color="#fff" />}
              {i === current && <View style={styles.dotCore} />}
            </View>
          </Fragment>
        ))}
      </View>
      <View style={styles.labels}>
        {steps.map((step, i) => (
          <Text
            key={step}
            numberOfLines={2}
            style={[styles.label, i <= current && styles.labelReached, i === 0 && styles.first, i === steps.length - 1 && styles.last]}
          >
            {step}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 14 },
  track: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },
  line: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.border },
  lineDone: { backgroundColor: colors.primary },
  dot: {
    width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 2, borderColor: colors.border,
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
  },
  dotDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  dotCurrent: { borderColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 5, shadowOffset: { width: 0, height: 0 }, elevation: 3 },
  dotCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  labels: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  label: { flex: 1, textAlign: "center", fontSize: 10.5, fontFamily: fonts.semibold, color: "#94a3b8" },
  labelReached: { color: colors.text },
  first: { textAlign: "left" },
  last: { textAlign: "right" },
});
