import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, fonts, radius } from "../../../../constants/theme";
import { manage, tabular } from "../../ui/tokens";
import type { BatchManifest } from "./use-batch";

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

/** Whether the Mac has everything: never sent, sent with items added since, or fully sent */
function sendState(batch: BatchManifest) {
  if (!batch.exportedAt) return { label: "Not sent yet", color: manage.attention, sent: false };
  const added = batch.items.length - (batch.exportedCount ?? 0);
  if (added > 0) return { label: `${added} new since ${time(batch.exportedAt)} send`, color: manage.attention, sent: false };
  return { label: `Sent at ${time(batch.exportedAt)}`, color: manage.live, sent: true };
}

function Figure({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.figure}>
      <Text style={[styles.value, tabular]}>{value}</Text>
      <Text style={styles.figureLabel}>{label}</Text>
    </View>
  );
}

interface BatchSummaryProps {
  batch: BatchManifest;
  products: number;
  onClear: () => void;
}

/** The batch at a glance: store, how much is captured, and whether it has reached the Mac */
export function BatchSummary({ batch, products, onClear }: BatchSummaryProps) {
  const state = sendState(batch);
  return (
    <View style={styles.card}>
      <Text style={styles.store} numberOfLines={1}>{batch.storeName.toUpperCase()}</Text>
      <View style={styles.figures}>
        <Figure value={batch.items.length} label={batch.items.length === 1 ? "item" : "items"} />
        <View style={styles.divider} />
        <Figure value={products} label={products === 1 ? "product" : "products"} />
      </View>
      <View style={styles.footer}>
        <View style={styles.status}>
          <View style={[styles.dot, { backgroundColor: state.color }]} />
          <Text style={styles.statusText}>{state.label}</Text>
        </View>
        {state.sent && (
          <TouchableOpacity onPress={onClear} style={styles.clear} accessibilityRole="button">
            <Text style={styles.clearText}>Clear from phone</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 12, borderRadius: radius.lg, backgroundColor: manage.ink },
  store: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.2, color: manage.inkMuted },
  figures: { flexDirection: "row", alignItems: "flex-end", gap: 18 },
  figure: { gap: 0 },
  value: { fontFamily: fonts.extrabold, fontSize: 34, lineHeight: 38, color: manage.inkText },
  figureLabel: { fontFamily: fonts.semibold, fontSize: 13, color: manage.inkMuted },
  divider: { width: 1, height: 36, marginBottom: 4, backgroundColor: manage.inkRaised },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTopWidth: 1, borderTopColor: manage.inkRaised },
  status: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontFamily: fonts.semibold, fontSize: 13, color: manage.inkText },
  clear: { minHeight: 44, justifyContent: "center", paddingLeft: 12 },
  clearText: { fontFamily: fonts.bold, fontSize: 13, color: colors.accent },
});
