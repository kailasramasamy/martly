import { View, StyleSheet } from "react-native";

export function FoodTypeMark({ foodType }: { foodType: string }) {
  const veg = foodType === "VEG" || foodType === "VEGAN";
  return (
    <View style={[styles.indicator, veg ? styles.vegBorder : styles.nvBorder]}>
      <View style={[styles.dot, veg ? styles.vegFill : styles.nvFill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  indicator: {
    position: "absolute", bottom: 6, left: 6, width: 12, height: 12,
    borderWidth: 1.5, borderRadius: 2, backgroundColor: "#fff",
    justifyContent: "center", alignItems: "center",
  },
  vegBorder: { borderColor: "#0a8f08" },
  nvBorder: { borderColor: "#b71c1c" },
  dot: { width: 5, height: 5, borderRadius: 3 },
  vegFill: { backgroundColor: "#0a8f08" },
  nvFill: { backgroundColor: "#b71c1c" },
});
