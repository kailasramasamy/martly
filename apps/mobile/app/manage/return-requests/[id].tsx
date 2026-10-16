import { useState } from "react";
import { View, Text, Image, ScrollView, Linking, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { can } from "@martly/shared/permissions";
import { colors, fonts, radius } from "../../../constants/theme";
import { useAuth } from "../../../lib/auth-context";
import { useResource } from "../../../lib/manage/use-resource";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { SectionCard } from "../../../components/manage/ui/SectionCard";
import { KeyValue } from "../../../components/manage/ui/KeyValue";
import { StatusPill } from "../../../components/manage/ui/StatusPill";
import { Button } from "../../../components/manage/ui/Button";
import { formatDate } from "../../../components/manage/ui/dates";
import { formatINR, manage, tabular } from "../../../components/manage/ui/tokens";
import { AccessGate } from "../../../components/manage/support/AccessGate";
import { ResolveSheet, type Resolution } from "../../../components/manage/returns/ResolveSheet";
import { RETURN_STATUS, reasonLabel, type ReturnRequestDetail } from "../../../components/manage/returns/types";

function ReturnDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useResource<ReturnRequestDetail>(`/api/v1/return-requests/${id}`);
  const [mode, setMode] = useState<Resolution | null>(null);
  const canResolve = !!user && can(user, "return-requests", "edit") && data?.status === "PENDING";

  const actions = canResolve ? (
    <>
      <Button label="Reject" icon="close" variant="danger" onPress={() => setMode("REJECTED")} style={{ flex: 1 }} />
      <Button label="Approve" icon="checkmark" onPress={() => setMode("APPROVED")} style={{ flex: 1 }} />
    </>
  ) : undefined;

  return (
    <ManageStackScreen title="Return request" loading={loading} error={error} onRetry={reload} actions={actions}>
      {data && (
        <>
          <SectionCard title="Request">
            <StatusPill {...RETURN_STATUS[data.status]} />
            <KeyValue label="Order" value={`#${data.order.id.slice(0, 8)}`} />
            <KeyValue label="Order total" value={formatINR(data.order.totalAmount)} />
            <KeyValue label="Reason" value={reasonLabel(data.reason)} />
            {data.description ? <KeyValue label="Details" value={data.description} /> : null}
            <KeyValue label="Requested" value={formatINR(data.requestedAmount)} />
            {data.approvedAmount != null && <KeyValue label="Refunded" value={formatINR(data.approvedAmount)} emphasis />}
            {data.adminNote ? <KeyValue label="Admin note" value={data.adminNote} /> : null}
            <KeyValue label="Created" value={formatDate(data.createdAt, true)} />
            {data.resolvedAt ? <KeyValue label="Resolved" value={formatDate(data.resolvedAt, true)} /> : null}
          </SectionCard>

          <SectionCard title="Customer and store">
            <KeyValue label="Customer" value={data.user.name} />
            <KeyValue label="Email" value={data.user.email} />
            <KeyValue label="Phone" value={data.user.phone} />
            <KeyValue label="Store" value={data.store.name} />
            {data.user.phone ? (
              <View style={styles.call}>
                <Button label="Call customer" icon="call-outline" variant="secondary" compact onPress={() => Linking.openURL(`tel:${data.user.phone}`)} />
              </View>
            ) : null}
          </SectionCard>

          {data.images.length > 0 && (
            <SectionCard title="Photos">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
                {data.images.map((uri) => <Image key={uri} source={{ uri }} style={styles.photo} />)}
              </ScrollView>
            </SectionCard>
          )}

          <SectionCard title="Returned items">
            {data.items.map((item) => (
              <View key={item.id} style={styles.item}>
                <View style={styles.itemText}>
                  <Text style={styles.itemName}>{item.orderItem.product.name}</Text>
                  <Text style={styles.itemMeta}>{item.orderItem.variant.name} · {item.quantity} x {formatINR(item.orderItem.unitPrice)}</Text>
                </View>
                <Text style={[styles.itemTotal, tabular]}>{formatINR(item.quantity * Number(item.orderItem.unitPrice))}</Text>
              </View>
            ))}
          </SectionCard>

          <ResolveSheet requestId={id} requestedAmount={Number(data.requestedAmount)} mode={mode} onClose={() => setMode(null)} onResolved={reload} />
        </>
      )}
    </ManageStackScreen>
  );
}

export default function ReturnDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AccessGate resource="return-requests"><ReturnDetail id={id} /></AccessGate>;
}

const styles = StyleSheet.create({
  call: { marginTop: 10, alignItems: "flex-start" },
  photos: { gap: 8 },
  photo: { width: 110, height: 110, borderRadius: radius.md, backgroundColor: manage.canvas },
  item: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: manage.hairline },
  itemText: { flex: 1, minWidth: 0 },
  itemName: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  itemMeta: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  itemTotal: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.text },
});
