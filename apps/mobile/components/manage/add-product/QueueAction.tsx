import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../constants/theme";
import { manage, tabular } from "../ui/tokens";

interface QueueActionProps {
  count: number;
  onPress: () => void;
}

/** Header link to the AI queue, with the number of items in progress or needing review */
export function QueueAction({ count, onPress }: QueueActionProps) {
  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `AI queue, ${count} waiting` : "AI queue"}
    >
      <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
      <Text style={styles.label}>AI queue</Text>
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={[styles.badgeText, tabular]}>{count > 99 ? "99+" : count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 44, minWidth: 44, justifyContent: "center" },
  label: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: manage.attention, alignItems: "center", justifyContent: "center" },
  badgeText: { fontFamily: fonts.extrabold, fontSize: 11, color: colors.accentText },
});
