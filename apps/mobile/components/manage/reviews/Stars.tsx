import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../constants/theme";

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <View style={styles.row} accessibilityLabel={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={value >= n ? "star" : value >= n - 0.5 ? "star-half" : "star-outline"}
          size={size}
          color={value >= n - 0.5 ? colors.accent : "#cbd5e1"}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", gap: 2 } });
