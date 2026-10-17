import { Text, StyleSheet } from "react-native";
import type { PromoDetail } from "@martly/shared/types";
import { SectionCard } from "../ui/SectionCard";
import { KeyValue } from "../ui/KeyValue";
import { Button } from "../ui/Button";
import { formatINR } from "../ui/tokens";
import { useResource } from "../../../lib/manage/use-resource";
import { colors, fonts } from "../../../constants/theme";
import type { MarketingResults } from "./plan-types";

const RESULT_DAYS = 30;

interface RedraftProps {
  left: number;
  busy: boolean;
  onRedraft: () => void;
}

export function RedraftCard({ left, busy, onRedraft }: RedraftProps) {
  return (
    <SectionCard title="Not happy with the draft?">
      <Text style={styles.note}>{`${left} free redraft${left === 1 ? "" : "s"} left. The AI drafts the banner, copy and products again.`}</Text>
      <Button label="Redraft" icon="refresh-outline" variant="secondary" onPress={onRedraft} loading={busy} style={styles.btn} />
    </SectionCard>
  );
}

export function PromoResultsCard({ promo }: { promo: PromoDetail }) {
  const { data } = useResource<MarketingResults>(`/api/v1/marketing/results?days=${RESULT_DAYS}`);
  const sales = data?.promotions.find((p) => p.id === promo.id);
  if (!data || !sales) return null;
  const banners = data.banners.filter((b) => b.promoId === promo.id);
  const views = banners.reduce((sum, b) => sum + b.views, 0);
  const taps = banners.reduce((sum, b) => sum + b.taps, 0);
  return (
    <SectionCard title="Results">
      <KeyValue label="Banner views" value={views.toLocaleString("en-IN")} />
      <KeyValue label="Banner taps" value={taps.toLocaleString("en-IN")} />
      <KeyValue label="Orders" value={sales.orders} />
      <KeyValue label="Units sold" value={sales.units} />
      <KeyValue label="Revenue" value={formatINR(sales.revenue)} emphasis />
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  btn: { marginTop: 12 },
});
