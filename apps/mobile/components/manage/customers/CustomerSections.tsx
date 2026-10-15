import { View, Text, Linking, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { colors, fonts } from "../../../constants/theme";
import { SectionCard } from "../ui/SectionCard";
import { KeyValue } from "../ui/KeyValue";
import { ListRow } from "../ui/ListRow";
import { StatusPill } from "../ui/StatusPill";
import { Button } from "../ui/Button";
import { formatDate } from "../ui/dates";
import { formatINR, manage, tabular, ORDER_STATUS } from "../ui/tokens";
import {
  FREQUENCY_LABEL,
  SUBSCRIPTION_STATUS,
  type CustomerDetail,
  type CustomerOrder,
  type CustomerSubscription,
  type WalletData,
} from "./types";

export function ProfileCard({ customer }: { customer: CustomerDetail }) {
  return (
    <SectionCard title="Profile">
      <Text style={styles.name}>{customer.name}</Text>
      <KeyValue label="Email" value={customer.email} />
      <KeyValue label="Phone" value={customer.phone} />
      <KeyValue label="Joined" value={formatDate(customer.createdAt)} />
      <KeyValue label="Orders" value={customer._count.orders} />
      <KeyValue label="Reviews" value={customer._count.reviews} />
      <KeyValue label="Referral code" value={customer.referralCode} />
      {customer.phone ? (
        <View style={styles.call}>
          <Button label="Call customer" icon="call-outline" variant="secondary" compact onPress={() => Linking.openURL(`tel:${customer.phone}`)} />
        </View>
      ) : null}
    </SectionCard>
  );
}

export function AddressesCard({ customer }: { customer: CustomerDetail }) {
  if (customer.addresses.length === 0) return null;
  return (
    <SectionCard title="Addresses">
      {customer.addresses.map((a) => (
        <View key={a.id} style={styles.address}>
          <Text style={styles.addressLabel}>{a.label}{a.isDefault ? " · Default" : ""}</Text>
          <Text style={styles.addressText}>{a.address}</Text>
        </View>
      ))}
    </SectionCard>
  );
}

export function WalletCard({ wallet, onAdjust }: { wallet: WalletData | null; onAdjust: () => void }) {
  return (
    <SectionCard title="Wallet" action={wallet ? { label: "Adjust", onPress: onAdjust } : undefined}>
      <Text style={[styles.balance, tabular]}>{formatINR(wallet?.balance ?? 0)}</Text>
      {wallet?.transactions.slice(0, 5).map((t) => (
        <KeyValue
          key={t.id}
          label={t.description ?? (t.type === "CREDIT" ? "Credit" : "Debit")}
          value={`${t.type === "CREDIT" ? "+" : "-"}${formatINR(t.amount)}`}
          valueColor={t.type === "CREDIT" ? "#15803d" : colors.error}
        />
      ))}
    </SectionCard>
  );
}

export function OrdersCard({ orders }: { orders: CustomerOrder[] }) {
  const router = useRouter();
  return (
    <SectionCard title="Recent orders" flush>
      {orders.length === 0 ? <Text style={styles.none}>No orders yet</Text> : orders.map((o) => (
        <ListRow
          key={o.id}
          title={`#${o.id.slice(0, 8)}`}
          caption={formatDate(o.createdAt, true)}
          value={formatINR(o.totalAmount)}
          trailing={<StatusPill {...(ORDER_STATUS[o.status] ?? ORDER_STATUS.PENDING)} />}
          chevron
          onPress={() => router.push(`/manage/orders/${o.id}`)}
        />
      ))}
    </SectionCard>
  );
}

export function SubscriptionsCard({ subscriptions }: { subscriptions: CustomerSubscription[] }) {
  if (subscriptions.length === 0) return null;
  return (
    <SectionCard title="Subscriptions" flush>
      {subscriptions.map((s) => (
        <ListRow
          key={s.id}
          title={s.items.map((i) => `${i.quantity} x ${i.storeProduct.product.name} (${i.storeProduct.variant.name})`).join(", ")}
          subtitle={`${FREQUENCY_LABEL[s.frequency] ?? s.frequency} · ${s.store.name}`}
          caption={s.nextDeliveryDate ? `Next ${formatDate(s.nextDeliveryDate)}` : undefined}
          trailing={<StatusPill {...(SUBSCRIPTION_STATUS[s.status] ?? SUBSCRIPTION_STATUS.ACTIVE)} />}
        />
      ))}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  name: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.text, marginBottom: 6 },
  call: { marginTop: 10, alignItems: "flex-start" },
  address: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: manage.hairline },
  addressLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  addressText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  balance: { fontFamily: fonts.extrabold, fontSize: 28, color: colors.text, marginBottom: 6 },
  none: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary, padding: 14 },
});
