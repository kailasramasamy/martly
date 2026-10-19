import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Linking } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { RETURN_COLLECT_DAYS, RETURN_EXPIRY_DAYS, RETURN_WINDOW_HOURS } from "@martly/shared/constants";
import { deliveredAt } from "@martly/shared/order-flow";
import { api } from "../../lib/api";
import { useToast } from "../../lib/toast-context";
import { colors, spacing, fontSize } from "../../constants/theme";
import type { ReturnRequestData } from "../../lib/types";

const STATUS_COLORS: Record<ReturnRequestData["status"], string> = {
  PENDING: "#f59e0b",
  IN_PROGRESS: "#3b82f6",
  APPROVED: "#22c55e",
  REJECTED: "#ef4444",
  EXPIRED: colors.textSecondary,
};

const STATUS_LABELS: Record<ReturnRequestData["status"], string> = {
  PENDING: "Pending review",
  IN_PROGRESS: "In progress",
  APPROVED: "Completed",
  REJECTED: "Rejected",
  EXPIRED: "Closed",
};

const money = (v: string | number) => `₹${Number(v).toFixed(0)}`;

function InProgress({ request, onSwitch, busy }: { request: ReturnRequestData; onSwitch: (m: "NEXT_ORDER" | "AT_STORE") => void; busy: boolean }) {
  const isReplace = request.remedy === "REPLACE";
  if (request.method === "KEEP") {
    return <Text style={styles.headline}>No need to return it. A free replacement comes with your next order.</Text>;
  }
  if (request.method === "AT_STORE") {
    const { store } = request;
    return (
      <>
        <Text style={styles.headline}>Drop the item at {store?.name ?? "the store"}</Text>
        {store?.address && <Text style={styles.detail}>{store.address}</Text>}
        <Text style={styles.detail}>
          {isReplace ? "Your replacement comes with your next order. " : ""}The return closes {RETURN_EXPIRY_DAYS} days after approval if the item isn{"’"}t returned.
        </Text>
        {store?.phone && (
          <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${store.phone}`)} activeOpacity={0.7}>
            <Ionicons name="call-outline" size={16} color={colors.primary} />
            <Text style={styles.callBtnText}>Call store</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.link} disabled={busy} onPress={() => onSwitch("NEXT_ORDER")}>
          <Text style={styles.linkText}>Collect with my next order instead</Text>
        </TouchableOpacity>
      </>
    );
  }
  return (
    <>
      <Text style={styles.headline}>Hand the item to our rider with your next order</Text>
      <Text style={styles.detail}>
        {isReplace ? "Replacement comes with your next order." : `${money(request.requestedAmount)} refund once we have it.`}
      </Text>
      <Text style={styles.detail}>No order in {RETURN_COLLECT_DAYS} days? We{"’"}ll ask you to drop it at the store.</Text>
      <TouchableOpacity style={styles.link} disabled={busy} onPress={() => onSwitch("AT_STORE")}>
        <Text style={styles.linkText}>I{"’"}ll drop it at the store instead</Text>
      </TouchableOpacity>
    </>
  );
}

function Outcome({ request }: { request: ReturnRequestData }) {
  if (request.status === "APPROVED") {
    return (
      <Text style={[styles.headline, { color: "#15803d" }]}>
        {request.remedy === "REPLACE" ? "Replacement sent" : `${money(request.approvedAmount ?? request.requestedAmount)} refunded to your wallet`}
      </Text>
    );
  }
  if (request.status === "EXPIRED") {
    return <Text style={styles.headline}>Closed {"—"} the item wasn{"’"}t returned in time</Text>;
  }
  return null;
}

export function ReturnStatusCard({ orderId, status, statusLogs, request, onChanged }: {
  orderId: string;
  status: string;
  statusLogs?: { status: string; createdAt: string }[];
  request: ReturnRequestData | null;
  onChanged: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const switchMethod = async (method: "NEXT_ORDER" | "AT_STORE") => {
    if (!request) return;
    setBusy(true);
    try {
      await api.patch(`/api/v1/return-requests/my-requests/${request.id}/method`, { method });
      toast.show("Return method updated", "success");
      onChanged();
    } catch (e: unknown) {
      toast.show(e instanceof Error ? e.message : "Couldn't update return method", "error");
    } finally {
      setBusy(false);
    }
  };

  if (!request) {
    const at = deliveredAt(statusLogs ?? []);
    if (status !== "DELIVERED" || !at || Date.now() - at.getTime() >= RETURN_WINDOW_HOURS * 3600 * 1000) return null;
    return (
      <TouchableOpacity style={styles.returnBtn} onPress={() => router.push({ pathname: "/return-request", params: { orderId } })} activeOpacity={0.7}>
        <Ionicons name="return-down-back-outline" size={18} color={colors.primary} />
        <Text style={styles.returnBtnText}>Request Return/Refund</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Return Request</Text>
        <View style={[styles.badge, { backgroundColor: STATUS_COLORS[request.status] }]}>
          <Text style={styles.badgeText}>{STATUS_LABELS[request.status]}</Text>
        </View>
      </View>
      <Text style={styles.reason}>{request.reason}</Text>
      {request.status === "PENDING" && (
        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>Requested Amount</Text>
          <Text style={styles.amountValue}>{money(request.requestedAmount)}</Text>
        </View>
      )}
      {request.status === "IN_PROGRESS" && <InProgress request={request} onSwitch={switchMethod} busy={busy} />}
      <Outcome request={request} />
      {(request.status === "APPROVED" || request.status === "REJECTED") && request.adminNote && (
        <Text style={styles.note}>{request.adminNote}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  title: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: fontSize.sm, fontWeight: "600", color: "#fff" },
  reason: { fontSize: fontSize.md, color: colors.textSecondary, marginBottom: spacing.sm },
  amountRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  amountLabel: { fontSize: fontSize.md, color: colors.text },
  amountValue: { fontSize: fontSize.md, fontWeight: "700", color: colors.text },
  headline: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
  detail: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
  callBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
    marginTop: spacing.sm,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  callBtnText: { fontSize: fontSize.md, fontWeight: "600", color: colors.primary },
  link: { minHeight: 44, justifyContent: "center", marginTop: 4 },
  linkText: { fontSize: fontSize.md, fontWeight: "600", color: colors.primary, textDecorationLine: "underline" },
  note: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontStyle: "italic",
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  returnBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primary + "08",
  },
  returnBtnText: { color: colors.primary, fontSize: fontSize.md, fontWeight: "600" },
});
