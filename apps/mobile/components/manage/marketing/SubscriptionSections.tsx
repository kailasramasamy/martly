import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DAY_LABELS } from "@martly/shared/constants";
import { SectionCard } from "../ui/SectionCard";
import { KeyValue } from "../ui/KeyValue";
import { ListRow } from "../ui/ListRow";
import { StatusPill } from "../ui/StatusPill";
import { formatDate } from "../ui/dates";
import { formatINR, manage, ORDER_STATUS, tabular } from "../ui/tokens";
import { colors, fonts } from "../../../constants/theme";
import { FREQUENCY_LABEL, SUBSCRIPTION_STATUS, type Subscription } from "./subscription-types";

function daysText(s: Subscription): string {
  if (s.selectedDays.length === 0) return "";
  if (s.frequency === "MONTHLY") return `Day ${s.selectedDays[0]} of month`;
  return s.selectedDays.map((d) => DAY_LABELS[d] ?? d).join(", ");
}

export function DetailsCard({ s }: { s: Subscription }) {
  const tone = SUBSCRIPTION_STATUS[s.status];
  return (
    <SectionCard title="Details">
      <View style={styles.pill}><StatusPill {...tone} /></View>
      <KeyValue label="Customer" value={s.user.name} />
      <KeyValue label="Phone" value={s.user.phone} />
      <KeyValue label="Store" value={s.store.name} />
      <KeyValue label="Frequency" value={FREQUENCY_LABEL[s.frequency] ?? s.frequency} />
      <KeyValue label="Days" value={daysText(s)} />
      <KeyValue label="Next delivery" value={formatDate(s.nextDeliveryDate)} />
      {s.status === "PAUSED" && s.pausedUntil ? <KeyValue label="Paused until" value={formatDate(s.pausedUntil)} /> : null}
      <KeyValue label="Address" value={s.deliveryAddress} />
      <KeyValue label="Auto-pay from wallet" value={s.autoPayWithWallet ? "Yes" : "No"} />
      <KeyValue label="Created" value={formatDate(s.createdAt, true)} />
    </SectionCard>
  );
}

interface ItemsProps {
  s: Subscription;
  editing: boolean;
  quantities: Record<string, number>;
  onQuantity: (storeProductId: string, quantity: number) => void;
  onEdit: () => void;
  onCancelEdit: () => void;
}

export function ItemsCard({ s, editing, quantities, onQuantity, onEdit, onCancelEdit }: ItemsProps) {
  const canEdit = s.status !== "CANCELLED";
  const action = editing ? { label: "Cancel", onPress: onCancelEdit } : canEdit ? { label: "Edit quantities", onPress: onEdit } : undefined;
  return (
    <SectionCard title="Items" action={action} flush>
      {s.items.map((item) => {
        const qty = quantities[item.storeProductId] ?? item.quantity;
        const name = item.storeProduct?.product?.name ?? "Item";
        return (
          <ListRow
            key={item.id}
            title={name}
            subtitle={item.storeProduct?.variant?.name}
            imageUrl={item.storeProduct?.product?.imageUrl ?? null}
            value={editing ? undefined : `${qty}x`}
            caption={item.storeProduct ? formatINR(item.storeProduct.price) : undefined}
            trailing={editing ? <Stepper value={qty} label={name} onChange={(q) => onQuantity(item.storeProductId, q)} /> : undefined}
          />
        );
      })}
    </SectionCard>
  );
}

function Stepper({ value, label, onChange }: { value: number; label: string; onChange: (q: number) => void }) {
  return (
    <View style={styles.stepper}>
      <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(Math.max(0, value - 1))} accessibilityLabel={`Decrease ${label}`}>
        <Ionicons name="remove" size={18} color={colors.text} />
      </TouchableOpacity>
      <Text style={[styles.qty, tabular]}>{value}</Text>
      <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(value + 1)} accessibilityLabel={`Increase ${label}`}>
        <Ionicons name="add" size={18} color={colors.text} />
      </TouchableOpacity>
    </View>
  );
}

export function HistoryCards({ s }: { s: Subscription }) {
  return (
    <>
      {s.skippedDates && s.skippedDates.length > 0 ? (
        <SectionCard title="Skip history">
          {s.skippedDates.map((d) => <KeyValue key={d.id} label={formatDate(d.date)} value={d.reason} />)}
        </SectionCard>
      ) : null}
      {s.orders && s.orders.length > 0 ? (
        <SectionCard title="Order history" flush>
          {s.orders.map((o) => (
            <ListRow key={o.id} title={`#${o.id.slice(0, 8)}`} caption={formatDate(o.createdAt, true)} value={formatINR(o.totalAmount)} trailing={<StatusPill {...(ORDER_STATUS[o.status] ?? ORDER_STATUS.PENDING)} />} />
          ))}
        </SectionCard>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  pill: { marginBottom: 6 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 4 },
  stepBtn: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: manage.line, alignItems: "center", justifyContent: "center" },
  qty: { minWidth: 24, textAlign: "center", fontFamily: fonts.extrabold, fontSize: 16, color: colors.text },
});
