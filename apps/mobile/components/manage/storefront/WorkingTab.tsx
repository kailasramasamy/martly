import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import type { StorefrontEffectiveness } from "@martly/shared/types";
import { colors, fonts } from "../../../constants/theme";
import { useResource } from "../../../lib/manage/use-resource";
import { toQuery } from "../../../lib/manage/query";
import { formatINR } from "../ui/tokens";
import { EmptyState } from "../ui/EmptyState";
import { KpiTile } from "../ui/KpiTile";
import { ListRow } from "../ui/ListRow";
import { SectionCard } from "../ui/SectionCard";
import { SegmentedTabs } from "../ui/SegmentedTabs";

const PERIODS = [{ value: "7" as const, label: "7 days" }, { value: "30" as const, label: "30 days" }];

const seen = (v: number, t: number) => `${v} views · ${t} taps`;

function Kpis({ e }: { e: StorefrontEffectiveness }) {
  const o = e.offers;
  return (
    <View style={styles.grid}>
      <View style={styles.cell}><KpiTile label="Sales" value={formatINR(e.revenue)} /></View>
      <View style={styles.cell}><KpiTile label="From Home" value={`${e.homeRevenueShare}%`} /></View>
      <View style={styles.cell}><KpiTile label="Buy X get Y" value={formatINR(o.buyGet.revenue)} /></View>
      <View style={styles.cell}><KpiTile label="Discounts" value={formatINR(o.discount.revenue)} /></View>
      <View style={styles.cell}><KpiTile label="Coupons used" value={String(o.coupons.redemptions)} /></View>
      <View style={styles.cell}><KpiTile label="Coupon savings" value={formatINR(o.coupons.discount)} /></View>
    </View>
  );
}

/** What shoppers did with the storefront: which Home rows and banners they tap and buy from, and what offers sold */
export function WorkingTab({ storeId }: { storeId: string }) {
  const [days, setDays] = useState<"7" | "30">("7");
  const { data, loading, error, reload } = useResource<StorefrontEffectiveness>(`/api/v1/storefront/effectiveness${toQuery({ storeId, days })}`);
  const body = loading || !data
    ? <EmptyState icon={error ? "cloud-offline-outline" : "pulse-outline"} title={error ? "Couldn't load" : "Loading"} message={error ?? undefined} action={error ? { label: "Try again", onPress: reload } : undefined} />
    : (
      <>
        <Kpis e={data} />
        <SectionCard title="Home rows" flush>
          {data.sections.length === 0
            ? <Text style={styles.empty}>Numbers build up as shoppers browse your Home screen. Check back in a few days.</Text>
            : data.sections.map((s) => (
              <ListRow key={s.sectionId} title={s.title ?? s.sectionType} subtitle={seen(s.views, s.taps)}
                caption={`${s.cartAdds} added to cart · ${s.orders} orders`} value={formatINR(s.revenue)} />
            ))}
        </SectionCard>
        <SectionCard title="Banners" flush>
          {data.banners.length === 0
            ? <Text style={styles.empty}>No banner views yet.</Text>
            : data.banners.map((b) => <ListRow key={b.bannerId} title={b.title ?? "Banner"} subtitle={`${seen(b.views, b.taps)} · ${b.ctr}% tapped`} />)}
        </SectionCard>
      </>
    );
  return (
    <>
      <SegmentedTabs options={PERIODS} value={days} onChange={setDays} />
      {body}
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cell: { flexBasis: "30%", flexGrow: 1 },
  empty: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.textSecondary, padding: 14, paddingTop: 4 },
});
