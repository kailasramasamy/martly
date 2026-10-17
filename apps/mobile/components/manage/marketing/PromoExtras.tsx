import { Text, StyleSheet } from "react-native";
import { BannerActionTypeLabels } from "@martly/shared/constants";
import type { PromoDetail } from "@martly/shared/types";
import { SectionCard } from "../ui/SectionCard";
import { KeyValue } from "../ui/KeyValue";
import { Button } from "../ui/Button";
import { formatINR } from "../ui/tokens";
import { formatDate } from "../ui/dates";
import { useResource } from "../../../lib/manage/use-resource";
import { colors, fonts } from "../../../constants/theme";
import type { MarketingResults } from "./plan-types";
import { discountLabel } from "./promo-utils";

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
  return (
    <SectionCard title="Results">
      <KeyValue label="Banner views" value={sales.views.toLocaleString("en-IN")} />
      <KeyValue label="Banner taps" value={sales.taps.toLocaleString("en-IN")} />
      <KeyValue label="Orders" value={sales.orders} />
      <KeyValue label="Units sold" value={sales.units} />
      <KeyValue label="Revenue" value={formatINR(sales.revenue)} emphasis />
    </SectionCard>
  );
}

/** What a manual promotion opens, discounts and when it starts */
export function ManualSummary({ promo }: { promo: PromoDetail }) {
  const type = promo.actionType as keyof typeof BannerActionTypeLabels | null;
  const showTarget = promo.actionTarget && (type === "SEARCH" || type === "URL");
  return (
    <SectionCard title="Promotion">
      <KeyValue label="Opens" value={type ? `${BannerActionTypeLabels[type]}${showTarget ? `: ${promo.actionTarget}` : ""}` : "-"} />
      <KeyValue label="Discount" value={discountLabel(promo.discountType, promo.discountValue)} />
      {promo.discountType ? <KeyValue label="Products covered" value={promo.productCount} /> : null}
      {promo.launchAt && promo.status === "READY" ? <KeyValue label="Goes live" value={formatDate(promo.launchAt, true)} /> : null}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  btn: { marginTop: 12 },
});
