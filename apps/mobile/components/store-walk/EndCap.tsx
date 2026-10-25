import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fonts } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";
import type { StoreProduct } from "../../lib/types";
import { Shelf, useShelves } from "./ShelfProducts";

// Fewer than this and there's no display to build
const MIN_DEALS = 2;

/** The display at the end of the aisle, as stores stand one: a red offers board over a shelf of the department's deals */
export function EndCap({ deals }: { deals: StoreProduct[] }) {
  const t = useStrings("storeWalk");
  const { shelves, variantsOf } = useShelves(deals);
  if (shelves.length === 0 || deals.length < MIN_DEALS) return null;
  return (
    <View style={styles.endcap}>
      <View style={styles.board}>
        <Ionicons name="pricetags" size={18} color="#fde68a" />
        <View style={styles.boardText}>
          <Text style={styles.title}>{t.endcapTitle}</Text>
          <Text style={styles.subtitle}>{t.endcapSubtitle}</Text>
        </View>
      </View>
      {shelves.slice(0, 1).map((row) => <Shelf key={row[0].product.id} items={row} variantsOf={variantsOf} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  endcap: { marginTop: 22 },
  board: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: -4,
    borderTopLeftRadius: 12, borderTopRightRadius: 12, backgroundColor: "#b91c1c",
  },
  boardText: { flex: 1 },
  title: { fontFamily: fonts.extrabold, fontSize: 16, color: "#ffffff", letterSpacing: 0.3 },
  subtitle: { fontFamily: fonts.semibold, fontSize: 12, color: "#fecaca" },
});
