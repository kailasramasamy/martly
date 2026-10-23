import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PhoneFrame } from "./PhoneFrame";
import { Bar, BrandMark, FestiveHero, Highlight, HomeHeader, TileRow } from "./primitives";
import { colors, fonts } from "../../../../constants/theme";

type IconName = keyof typeof Ionicons.glyphMap;

function Tab({ icon, label, active }: { icon: IconName; label: string; active?: boolean }) {
  const tint = active ? colors.primary : "#94a3b8";
  return (
    <View style={styles.tab}>
      <Ionicons name={icon} size={16} color={tint} />
      <Text style={[styles.label, { color: tint }]}>{label}</Text>
    </View>
  );
}

/** Bottom bar whose last slot carries the brand logo */
export function TabSlotMockup() {
  return (
    <PhoneFrame>
      <HomeHeader />
      <FestiveHero />
      <View style={styles.content}>
        <Bar w={80} h={6} style={{ backgroundColor: "#cbd5e1" }} />
        <TileRow />
      </View>
      <View style={styles.bar}>
        <Tab icon="home" label="Home" active />
        <Tab icon="grid-outline" label="Categories" />
        <Tab icon="cart-outline" label="Cart" />
        <Highlight style={styles.slot}>
          <View style={styles.tab}>
            <BrandMark size={22} round />
            <Text style={[styles.label, { color: colors.text }]}>Brand</Text>
          </View>
        </Highlight>
      </View>
    </PhoneFrame>
  );
}

const styles = StyleSheet.create({
  content: { padding: 8, gap: 5 },
  bar: {
    position: "absolute", left: 0, right: 0, bottom: 0, height: 58, backgroundColor: "#ffffff", borderTopWidth: 1, borderTopColor: "#e2e8f0",
    flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingHorizontal: 4, paddingBottom: 4,
  },
  tab: { alignItems: "center", gap: 2, minWidth: 40, paddingVertical: 3 },
  label: { fontFamily: fonts.semibold, fontSize: 7 },
  slot: { borderRadius: 10, paddingHorizontal: 3 },
});
