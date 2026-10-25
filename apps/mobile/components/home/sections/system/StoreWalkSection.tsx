import { memo } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { SystemSection } from "@martly/shared/types";
import { colors, fonts } from "../../../../constants/theme";
import { useStrings } from "../../../../lib/i18n/use-strings";
import { walkMinutes } from "../../../../lib/walk-session";

interface Teaser { aisleCount: number; dueCount: number; shelves: string[][] }

// The starting department's first aisles as shelves, each stocked with photos of its best sellers at this store, each
// with a soft shadow where it stands on the plank
function Shelves({ shelves }: { shelves: string[][] }) {
  return (
    <View style={styles.shelves} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {shelves.map((packs, row) => (
        <View key={row} style={styles.shelf}>
          {packs.map((uri) => (
            <View key={uri} style={styles.pack}>
              <Image source={{ uri }} style={styles.packImage} />
              <View style={styles.packShadow} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function Chip({ label }: { label: string }) {
  return <View style={styles.chip}><Text style={styles.chipText}>{label}</Text></View>;
}

/** "Walk the store": go aisle by aisle like in the shop, with the shopper's due items pointed out on the way */
export const StoreWalkSection = memo(function StoreWalkSection({ section }: { section: SystemSection }) {
  const t = useStrings("storeWalk");
  const { aisleCount, dueCount, shelves = [] } = section.data as unknown as Teaser;
  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.top}>
          <View style={styles.text}>
            <View style={styles.kicker}><Text style={styles.kickerText}>{t.cardKicker.toUpperCase()}</Text></View>
            <Text style={styles.title}>{t.cardTitle}</Text>
            <Text style={styles.body}>{t.cardBody}</Text>
          </View>
          {shelves.length > 0 && <Shelves shelves={shelves} />}
        </View>
        <View style={styles.chips}>
          {dueCount > 0 && <Chip label={t.cardDue(dueCount)} />}
          <Chip label={t.aisles(aisleCount)} />
          <Chip label={t.minutes(walkMinutes(aisleCount))} />
        </View>
        <TouchableOpacity style={styles.start} onPress={() => router.push("/store-walk")} activeOpacity={0.85} accessibilityRole="button">
          <Text style={styles.startText}>{t.startWalking}</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.primaryDark} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, marginTop: 16 },
  card: { borderRadius: 20, backgroundColor: colors.primaryDark, padding: 18, gap: 14, overflow: "hidden" },
  top: { flexDirection: "row", gap: 12 },
  shelves: { width: 136, gap: 6 },
  shelf: { flexDirection: "row", gap: 3, borderBottomWidth: 3, borderBottomColor: colors.primaryLight },
  pack: { flex: 1, alignItems: "center" },
  packImage: { width: "100%", aspectRatio: 1, resizeMode: "contain", borderRadius: 4, backgroundColor: "#ffffff" },
  packShadow: { width: "70%", height: 4, marginTop: -3, borderRadius: 4, backgroundColor: "rgba(15,23,42,0.22)" },
  text: { flex: 1, gap: 6 },
  kicker: { alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, backgroundColor: colors.salePill },
  kickerText: { fontFamily: fonts.extrabold, fontSize: 11, color: colors.salePillText },
  title: { fontFamily: fonts.extrabold, fontSize: 21, color: "#ffffff" },
  body: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: "#ccfbf1" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.primary },
  chipText: { fontFamily: fonts.semibold, fontSize: 12, color: "#ccfbf1" },
  start: { height: 46, borderRadius: 12, backgroundColor: "#ffffff", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  startText: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.primaryDark },
});
