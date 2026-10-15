import { View, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { can } from "@martly/shared/permissions";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { useResource } from "../../../lib/manage/use-resource";
import { useAction } from "../../../lib/manage/use-action";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { SectionCard } from "../../../components/manage/ui/SectionCard";
import { KeyValue } from "../../../components/manage/ui/KeyValue";
import { StatusPill } from "../../../components/manage/ui/StatusPill";
import { Button } from "../../../components/manage/ui/Button";
import { EmptyState } from "../../../components/manage/ui/EmptyState";
import { formatDate } from "../../../components/manage/ui/dates";
import { formatINR } from "../../../components/manage/ui/tokens";
import { AccessGate } from "../../../components/manage/support/AccessGate";
import { MessageBubble } from "../../../components/manage/support/MessageBubble";
import { Composer } from "../../../components/manage/support/Composer";
import { TICKET_PRIORITY, TICKET_STATUS, type TicketDetail } from "../../../components/manage/support/types";

function TicketScreen({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { data, setData, loading, error, reload } = useResource<TicketDetail>(`/api/v1/support/tickets/${id}`);
  const { run, running } = useAction();
  const canReply = !!user && can(user.role, "support-tickets", "edit") && data?.status !== "CLOSED";

  const patch = async (body: { reply?: string; status?: string }, success: string) => {
    const res = await run(() => api.patch<TicketDetail>(`/api/v1/support/tickets/${id}`, body), success);
    if (res) setData(res.data);
    return !!res;
  };

  return (
    <ManageStackScreen
      title="Support ticket"
      loading={loading}
      error={error}
      onRetry={reload}
      actions={canReply ? <Composer sending={running} onSend={(text) => patch({ reply: text }, "Reply sent")} /> : undefined}
    >
      {data && (
        <>
          <SectionCard title={data.subject}>
            <View style={styles.pills}>
              <StatusPill {...TICKET_STATUS[data.status]} />
              <StatusPill {...TICKET_PRIORITY[data.priority]} />
            </View>
            <KeyValue label="Customer" value={data.user.name} />
            <KeyValue label="Contact" value={data.user.phone ?? data.user.email} />
            <KeyValue label="Store" value={data.store?.name} />
            <KeyValue label="Created" value={formatDate(data.createdAt, true)} />
            {data.order ? <KeyValue label="Order" value={`#${data.order.id.slice(0, 8)} · ${data.order.status} · ${formatINR(data.order.totalAmount)}`} /> : null}
            {data.order ? <View style={styles.link}><Button label="View order" icon="receipt-outline" variant="secondary" compact onPress={() => router.push(`/manage/orders/${data.order?.id}`)} /></View> : null}
            {canReply && (
              <View style={styles.statusActions}>
                {data.status === "OPEN" && <Button label="Mark resolved" icon="checkmark-circle-outline" compact disabled={running} onPress={() => patch({ status: "RESOLVED" }, "Ticket resolved")} />}
                <Button label="Close ticket" icon="lock-closed-outline" variant="secondary" compact disabled={running} onPress={() => patch({ status: "CLOSED" }, "Ticket closed")} />
              </View>
            )}
          </SectionCard>

          <View style={styles.thread}>
            {data.messages.length === 0
              ? <EmptyState icon="chatbubbles-outline" title="No messages yet" />
              : data.messages.map((m, i) => <MessageBubble key={`${m.timestamp}-${i}`} message={m} />)}
          </View>
        </>
      )}
    </ManageStackScreen>
  );
}

export default function SupportTicketRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AccessGate resource="support-tickets"><TicketScreen id={id} /></AccessGate>;
}

const styles = StyleSheet.create({
  pills: { flexDirection: "row", gap: 8, marginBottom: 6 },
  link: { marginTop: 10, alignItems: "flex-start" },
  statusActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  thread: { gap: 10 },
});
