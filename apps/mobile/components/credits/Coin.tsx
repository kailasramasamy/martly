import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../../constants/theme";

/** A gold rupee coin, the mark of Martly Cash */
export function Coin({ size }: { size: number }) {
  return (
    <View style={[styles.coin, { width: size, height: size, borderRadius: size / 2 }]}>
      <View style={[styles.rim, { width: size * 0.78, height: size * 0.78, borderRadius: size * 0.39 }]}>
        <Text style={[styles.rupee, { fontSize: size * 0.46 }]}>{"₹"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  coin: { backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#d97706" },
  rim: { borderWidth: 1.5, borderColor: "#d97706", alignItems: "center", justifyContent: "center" },
  rupee: { fontFamily: fonts.extrabold, color: colors.accentText },
});
