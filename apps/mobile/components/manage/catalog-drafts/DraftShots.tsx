import { useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CatalogDraftShot } from "@martly/shared/types";
import { colors, fonts, radius } from "../../../constants/theme";
import { SectionCard } from "../ui/SectionCard";
import { StatusPill } from "../ui/StatusPill";
import { manage } from "../ui/tokens";

const SOURCE_LABEL = { openai: "AI retouch", plain: "Plain", photoroom: "Photoroom" } as const;
const VERDICT: Record<NonNullable<CatalogDraftShot["verdict"]>, { label: string; color: string; bg: string }> = {
  pass: { label: "Matches", color: "#15803d", bg: "#dcfce7" },
  minor_only: { label: "Minor changes", color: "#b45309", bg: "#fef3c7" },
  fail: { label: "Altered", color: "#b91c1c", bg: "#fee2e2" },
};

function Frame({ uri, caption }: { uri: string | null; caption: string }) {
  return (
    <View style={styles.frame}>
      {uri ? <Image source={{ uri }} style={styles.image} resizeMode="contain" /> : <View style={[styles.image, styles.pending]}><Text style={styles.caption}>Not ready</Text></View>}
      <Text style={styles.caption}>{caption}</Text>
    </View>
  );
}

function Differences({ items }: { items: string[] }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <View>
      <TouchableOpacity style={styles.toggle} onPress={() => setOpen((o) => !o)} accessibilityRole="button">
        <Text style={styles.toggleText}>{items.length} difference{items.length > 1 ? "s" : ""}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.primary} />
      </TouchableOpacity>
      {open && items.map((d, i) => <Text key={i} style={styles.diff}>{d}</Text>)}
    </View>
  );
}

function Shot({ shot }: { shot: CatalogDraftShot }) {
  const verdict = shot.verdict ? VERDICT[shot.verdict] : null;
  return (
    <View style={styles.shot}>
      <View style={styles.head}>
        <Text style={styles.role}>{shot.role ?? `Photo ${shot.index + 1}`}</Text>
        {shot.source && <StatusPill label={SOURCE_LABEL[shot.source]} color={colors.textSecondary} bg={manage.canvas} />}
        {verdict && <StatusPill label={verdict.label} color={verdict.color} bg={verdict.bg} />}
      </View>
      <View style={styles.pair}>
        <Frame uri={shot.original} caption="Original" />
        <Frame uri={shot.processed} caption="Listing" />
      </View>
      <Differences items={shot.differences} />
    </View>
  );
}

export function DraftShots({ shots }: { shots: CatalogDraftShot[] }) {
  return (
    <SectionCard title={`Photos (${shots.length})`}>
      <View style={styles.list}>{shots.map((s) => <Shot key={s.index} shot={s} />)}</View>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  list: { gap: 16 },
  shot: { gap: 8 },
  head: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  role: { fontFamily: fonts.bold, fontSize: 14, color: colors.text, textTransform: "capitalize", marginRight: 4 },
  pair: { flexDirection: "row", gap: 10 },
  frame: { flex: 1, gap: 4 },
  image: { width: "100%", aspectRatio: 1, borderRadius: radius.md, backgroundColor: manage.canvas },
  pending: { alignItems: "center", justifyContent: "center" },
  caption: { fontFamily: fonts.medium, fontSize: 11, color: manage.muted, textAlign: "center" },
  toggle: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44 },
  toggleText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  diff: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18, color: colors.textSecondary, paddingVertical: 4 },
});
