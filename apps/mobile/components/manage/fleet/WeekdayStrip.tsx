import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, fonts } from "../../../constants/theme";
import { manage } from "../ui/tokens";
import { WEEKDAY_LETTERS, WEEKDAY_NAMES } from "./windows";

interface WeekdayStripProps {
  /** Weekdays (0 = Sunday) the window runs on */
  available: Set<number>;
  /** Weekdays highlighted as on; defaults to all available */
  selected?: Set<number>;
  onToggle?: (day: number) => void;
}

/** S M T W T F S: lit where the window runs; tappable when `onToggle` is given */
export function WeekdayStrip({ available, selected = available, onToggle }: WeekdayStripProps) {
  return (
    <View style={styles.row}>
      {WEEKDAY_LETTERS.map((letter, day) => {
        const on = selected.has(day);
        const enabled = !!onToggle && available.has(day);
        return (
          <TouchableOpacity
            key={WEEKDAY_NAMES[day]}
            style={[styles.day, on && styles.dayOn, !available.has(day) && styles.dayOff, onToggle && styles.dayTap]}
            disabled={!enabled}
            onPress={() => onToggle?.(day)}
            accessibilityRole="button"
            accessibilityLabel={WEEKDAY_NAMES[day]}
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.letter, on && styles.letterOn]}>{letter}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 6 },
  day: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: manage.canvas },
  dayTap: { width: 40, height: 44, borderRadius: 12 },
  dayOn: { backgroundColor: colors.primary },
  dayOff: { opacity: 0.35 },
  letter: { fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary },
  letterOn: { color: "#fff" },
});
