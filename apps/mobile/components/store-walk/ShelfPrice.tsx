import { StyleSheet, Text } from "react-native";
import { fonts } from "../../constants/theme";

/** The price is what a shopper looks for on a shelf label, so it's the boldest thing on it */
export function ShelfPrice({ amount, size }: { amount: number; size: number }) {
  return <Text style={[styles.price, { fontSize: size, lineHeight: size * 1.25 }]}>{"₹"}{Math.round(amount).toLocaleString("en-IN")}</Text>;
}

const styles = StyleSheet.create({
  price: { fontFamily: fonts.extrabold, color: "#1e3a8a" },
});
