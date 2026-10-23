import { View, Text, Linking, StyleSheet } from "react-native";
import { getApiUrl } from "../../../../lib/api";
import { colors, fonts } from "../../../../constants/theme";
import { SectionCard } from "../../ui/SectionCard";
import { KeyValue } from "../../ui/KeyValue";
import { KpiTile } from "../../ui/KpiTile";
import { Button } from "../../ui/Button";
import { manage, tabular, formatINR } from "../../ui/tokens";
import { formatDate } from "../../ui/dates";
import type { Campaign } from "../types";
import { targetingText } from "./campaign-utils";

const num = (v: number) => v.toLocaleString("en-IN");

export function DetailsCard({ campaign }: { campaign: Campaign }) {
  const order = campaign.adOrder;
  const unit = campaign.product.kind === "BRAND_CPM" ? "thousand views" : "week(s)";
  const discount = campaign.discountType === "PERCENTAGE" ? `${campaign.discountValue}% off` : `${formatINR(campaign.discountValue ?? 0)} off`;

  return (
    <SectionCard title="Details">
      <KeyValue label="Brand" value={campaign.brand.name} />
      <KeyValue label="Package" value={`${campaign.product.name} × ${campaign.quantity} ${unit}`} />
      <KeyValue label="Runs" value={`${formatDate(campaign.startsAt)} – ${formatDate(campaign.endsAt)}`} />
      {campaign.category && <KeyValue label="Category" value={campaign.category.name} />}
      <KeyValue label="Where it runs" value={targetingText(campaign)} />
      {campaign.discountType && <KeyValue label="Discount" value={discount} />}
      <KeyValue label="Price" value={`${formatINR(campaign.product.price * campaign.quantity)} + GST`} />
      {order && <KeyValue label="Order" value={`${order.number ?? "Pending"} · ${formatINR(order.total)} · ${order.status}`} />}
      {order?.invoiceUrl && (
        <Button label="Open invoice" icon="document-text-outline" variant="ghost" compact onPress={() => void Linking.openURL(`${getApiUrl()}${order.invoiceUrl}`)} style={styles.invoice} />
      )}
    </SectionCard>
  );
}

export function ResultsCard({ results }: { results: NonNullable<Campaign["results"]> }) {
  const { total } = results;
  return (
    <SectionCard title="Results">
      <View style={styles.tiles}>
        <KpiTile label="Views" value={num(total.views)} />
        <KpiTile label="Taps" value={num(total.taps)} />
        <KpiTile label="CTR" value={`${total.ctr}%`} />
      </View>
      <View style={styles.tiles}>
        <KpiTile label="Orders" value={num(total.orders)} />
        <KpiTile label="Revenue" value={formatINR(total.revenue)} />
      </View>
      {results.stores.map((s) => (
        <View key={s.storeId} style={styles.store}>
          <Text style={styles.storeName} numberOfLines={1}>{s.store}</Text>
          <Text style={[styles.storeStats, tabular]}>
            {num(s.views)} views · {num(s.taps)} taps · {s.ctr}% · {num(s.orders)} orders · {formatINR(s.revenue)}
          </Text>
        </View>
      ))}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  invoice: { alignSelf: "flex-start", marginTop: 4 },
  tiles: { flexDirection: "row", gap: 8, marginBottom: 8 },
  store: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: manage.hairline },
  storeName: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  storeStats: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
});
