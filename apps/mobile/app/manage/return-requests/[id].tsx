import { useState } from "react";
import { View, Image, ScrollView, Linking, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { can } from "@martly/shared/permissions";
import { radius } from "../../../constants/theme";
import { useAuth } from "../../../lib/auth-context";
import { useResource } from "../../../lib/manage/use-resource";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { SectionCard } from "../../../components/manage/ui/SectionCard";
import { KeyValue } from "../../../components/manage/ui/KeyValue";
import { StatusPill } from "../../../components/manage/ui/StatusPill";
import { Button } from "../../../components/manage/ui/Button";
import { formatDate } from "../../../components/manage/ui/dates";
import { formatINR, manage } from "../../../components/manage/ui/tokens";
import { AccessGate } from "../../../components/manage/support/AccessGate";
import { useAction } from "../../../lib/manage/use-action";
import { api } from "../../../lib/api";
import { ConfirmDialog } from "../../../components/manage/ui/ConfirmDialog";
import { OutcomeRows } from "../../../components/manage/returns/OutcomeRows";
import { ReturnedItems } from "../../../components/manage/returns/ReturnedItems";
import { ResolveSheet, type Resolution } from "../../../components/manage/returns/ResolveSheet";
import { RETURN_STATUS, reasonLabel, type ReturnRequestDetail } from "../../../components/manage/returns/types";
import { orderRef } from "../../../components/manage/rider/format";

function ReturnDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useResource<ReturnRequestDetail>(`/api/v1/return-requests/${id}`);
  const { run, running } = useAction();
  const [mode, setMode] = useState<Resolution | null>(null);
  const [confirmReceive, setConfirmReceive] = useState(false);
  const canEdit = !!user && can(user, "return-requests", "edit");
  const canResolve = canEdit && data?.status === "PENDING";
  const canReceive = canEdit && data?.status === "IN_PROGRESS" && data.method !== "KEEP" && !data.receivedAt;

  const receive = async () => {
    const done = await run(() => api.patch(`/api/v1/return-requests/${id}/receive`), "Marked as received");
    if (!done) return;
    setConfirmReceive(false);
    reload();
  };

  const actions = canResolve ? (
    <>
      <Button label="Reject" icon="close" variant="danger" onPress={() => setMode("REJECTED")} style={{ flex: 1 }} />
      <Button label="Approve" icon="checkmark" onPress={() => setMode("APPROVED")} style={{ flex: 1 }} />
    </>
  ) : canReceive ? (
    <Button label="Mark received at store" icon="checkmark" onPress={() => setConfirmReceive(true)} style={{ flex: 1 }} />
  ) : undefined;

  return (
    <ManageStackScreen title="Return request" loading={loading} error={error} onRetry={reload} actions={actions}>
      {data && (
        <>
          <SectionCard title="Request">
            <StatusPill {...RETURN_STATUS[data.status]} />
            <KeyValue label="Order" value={orderRef(data.order.id)} />
            <KeyValue label="Order total" value={formatINR(data.order.totalAmount)} />
            <KeyValue label="Reason" value={reasonLabel(data.reason)} />
            {data.description ? <KeyValue label="Details" value={data.description} /> : null}
            <KeyValue label="Requested" value={formatINR(data.requestedAmount)} />
            <OutcomeRows request={data} />
            {data.approvedAmount != null && <KeyValue label="Refund amount" value={formatINR(data.approvedAmount)} emphasis />}
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

          <ReturnedItems request={data} />

          <ResolveSheet request={data} mode={mode} onClose={() => setMode(null)} onResolved={reload} />
          <ConfirmDialog
            visible={confirmReceive}
            title="Mark received at store?"
            message={data.remedy === "REFUND" ? "The item is back with the store. The refund is paid to the customer's wallet now." : "The item is back with the store."}
            confirmLabel="Mark received"
            confirmVariant="primary"
            running={running}
            onConfirm={receive}
            onClose={() => setConfirmReceive(false)}
          />
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
});
