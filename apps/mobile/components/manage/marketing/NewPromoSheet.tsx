import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius } from "../../../constants/theme";
import { BottomSheet } from "../../search/BottomSheet";
import { manage } from "../ui/tokens";
import { promotionsLeft, useEntitlements } from "./use-entitlements";

interface Choice {
  href: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: { color: string; bg: string };
  title: string;
  body: string;
  chip: string;
}

function ChoiceCard({ choice, onPick }: { choice: Choice; onPick: (href: string) => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPick(choice.href)} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={choice.title}>
      <View style={[styles.icon, { backgroundColor: choice.tint.bg }]}>
        <Ionicons name={choice.icon} size={22} color={choice.tint.color} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{choice.title}</Text>
        <Text style={styles.body}>{choice.body}</Text>
        <View style={[styles.chip, { backgroundColor: choice.tint.bg }]}>
          <Text style={[styles.chipText, { color: choice.tint.color }]}>{choice.chip}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={manage.muted} />
    </TouchableOpacity>
  );
}

/** How to start a promotion: let the AI build it from a brief, or set it up by hand */
export function NewPromoSheet({ visible, onPick, onClose }: { visible: boolean; onPick: (href: string) => void; onClose: () => void }) {
  const { data: entitlements } = useEntitlements();
  const left = entitlements ? promotionsLeft(entitlements) : null;
  const choices: Choice[] = [
    {
      href: "/manage/promos/new", icon: "sparkles", tint: { color: colors.primary, bg: manage.tint },
      title: "AI promotion", body: "Describe the offer. AI picks the products, writes the copy and designs the banner.",
      chip: left === null ? "Uses 1 promotion credit" : `Uses 1 credit · ${left} left`,
    },
    {
      href: "/manage/promos/manual", icon: "options-outline", tint: { color: "#6d28d9", bg: "#ede9fe" },
      title: "Manual promotion", body: "Choose what it covers, the discount and the banners yourself.",
      chip: "No credit · uses banner slots",
    },
  ];
  return (
    <BottomSheet visible={visible} title="New promotion" onClose={onClose}>
      <View style={styles.list}>
        {choices.map((c) => <ChoiceCard key={c.href} choice={c} onPick={onPick} />)}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10, paddingBottom: 8 },
  card: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 14, minHeight: 64,
    backgroundColor: manage.card, borderRadius: radius.lg, borderWidth: 1, borderColor: manage.line,
  },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  text: { flex: 1 },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  body: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.textSecondary, marginTop: 2 },
  chip: { alignSelf: "flex-start", marginTop: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  chipText: { fontFamily: fonts.semibold, fontSize: 11.5 },
});
