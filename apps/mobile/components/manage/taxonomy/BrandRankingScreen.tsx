import { useEffect, useState } from "react";
import { View, Text, FlatList, Image, ScrollView, TouchableOpacity, Alert, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { FESTIVAL_REGIONS, type FestivalRegion } from "@martly/shared/constants";
import type { BrandRankingRow, BrandRankingSource } from "@martly/shared/types";
import { colors, fonts, radius } from "../../../constants/theme";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useResource } from "../../../lib/manage/use-resource";
import { IconStep } from "../home-layout/SectionRow";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { ListSkeleton } from "../ui/ListSkeleton";
import { StickyActionBar } from "../ui/StickyActionBar";
import { manage, tabular } from "../ui/tokens";

interface BrandRankingScreenProps {
  id: string;
  level: "category" | "subcategory";
}

const SOURCE_LABEL: Record<BrandRankingSource, string> = {
  here: "Ranked", allIndia: "All India", category: "Category", region: "Regional", national: "National",
};

const REGIONS = Object.keys(FESTIVAL_REGIONS) as FestivalRegion[];

function BrandRow({ row, index, count, busy, onMove }: { row: BrandRankingRow; index: number; count: number; busy: boolean; onMove: (to: number) => void }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rank, tabular]}>{index + 1}</Text>
      {row.imageUrl
        ? <Image source={{ uri: row.imageUrl }} style={styles.logo} resizeMode="contain" />
        : <View style={[styles.logo, styles.logoFallback]}><Text style={styles.initial}>{row.name.charAt(0).toUpperCase()}</Text></View>}
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{row.name}</Text>
        <Text style={styles.meta}>{row.products} {row.products === 1 ? "product" : "products"} · {SOURCE_LABEL[row.source]}</Text>
      </View>
      <IconStep icon="arrow-up" label={`Move ${row.name} up`} disabled={busy || index === 0} onPress={() => onMove(index - 1)} />
      <IconStep icon="arrow-down" label={`Move ${row.name} down`} disabled={busy || index === count - 1} onPress={() => onMove(index + 1)} />
    </View>
  );
}

function RegionChips({ value, onChange }: { value: FestivalRegion; onChange: (r: FestivalRegion) => void }) {
  return (
    <View style={styles.chipsWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {REGIONS.map((r) => (
          <TouchableOpacity key={r} style={[styles.chip, r === value && styles.chipOn]} onPress={() => onChange(r)} accessibilityRole="button" accessibilityState={{ selected: r === value }}>
            <Text style={[styles.chipText, r === value && styles.chipTextOn]}>{FESTIVAL_REGIONS[r]}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

export function BrandRankingScreen({ id, level }: BrandRankingScreenProps) {
  const [region, setRegion] = useState<FestivalRegion>("ALL");
  const base = `/api/v1/brand-ranking/${level}/${id}`;
  const { data, setData, loading, error, reload } = useResource<BrandRankingRow[]>(`${base}?region=${region}`);
  const [rows, setRows] = useState<BrandRankingRow[]>([]);
  const { run, running } = useAction();

  useEffect(() => setRows(data ?? []), [data]);

  const changed = rows.some((r, i) => r.id !== data?.[i]?.id);
  const hasOwnOrder = (data ?? []).some((r) => r.source === "here");

  const move = (from: number, to: number) => {
    const next = [...rows];
    next.splice(to, 0, ...next.splice(from, 1));
    setRows(next);
  };

  const save = async () => {
    const res = await run(() => api.put<BrandRankingRow[]>(base, { region, brandIds: rows.map((r) => r.id) }), "Order saved");
    if (res) setData(res.data);
  };

  const reset = async () => {
    const res = await run(() => api.delete<BrandRankingRow[]>(`${base}?region=${region}`), "Order reset");
    if (res) setData(res.data);
  };

  const confirmReset = () =>
    Alert.alert("Reset this order?", `${FESTIVAL_REGIONS[region]} goes back to the fallback order.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Reset", style: "destructive", onPress: reset },
    ]);

  const help = "Push brands up or down in this category. Saved per region; a region without its own order uses All India, then each brand's own popularity."
    + (level === "subcategory" ? " A subcategory's order overrides its category's." : "");

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: "Brand ranking" }} />
      <RegionChips value={region} onChange={setRegion} />
      {loading ? <ListSkeleton /> : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<Text style={styles.help}>{help}</Text>}
          ListEmptyComponent={error
            ? <EmptyState icon="cloud-offline-outline" title="Couldn't load" message={error} action={{ label: "Try again", onPress: reload }} />
            : <EmptyState icon="pricetags-outline" title="No brands" message="No brands are sold here yet." />}
          renderItem={({ item, index }) => <BrandRow row={item} index={index} count={rows.length} busy={running} onMove={(to) => move(index, to)} />}
        />
      )}
      <StickyActionBar>
        <Button label="Reset" variant="secondary" onPress={confirmReset} disabled={!hasOwnOrder || changed} loading={running} style={styles.reset} />
        <Button label="Save order" onPress={save} disabled={!changed} loading={running} style={styles.save} />
      </StickyActionBar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: manage.canvas },
  chipsWrap: { backgroundColor: manage.card, borderBottomWidth: 1, borderBottomColor: manage.line },
  chips: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 14, justifyContent: "center", borderRadius: radius.xl, borderWidth: 1, borderColor: manage.line, backgroundColor: manage.card },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  chipTextOn: { color: "#fff" },
  list: { paddingBottom: 16 },
  help: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary, paddingHorizontal: 16, paddingVertical: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: manage.card, borderRadius: radius.lg, borderWidth: 1, borderColor: manage.line, marginHorizontal: 12, marginTop: 8, paddingLeft: 12, paddingRight: 4, minHeight: 60 },
  rank: { fontFamily: fonts.extrabold, fontSize: 17, color: manage.muted, width: 28 },
  logo: { width: 40, height: 40, borderRadius: radius.md },
  logoFallback: { backgroundColor: manage.tint, alignItems: "center", justifyContent: "center" },
  initial: { fontFamily: fonts.bold, fontSize: 17, color: colors.primary },
  body: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  reset: { flex: 1 },
  save: { flex: 2 },
});
