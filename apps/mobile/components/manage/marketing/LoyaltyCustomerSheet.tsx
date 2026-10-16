import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { BottomSheet } from "../../search/BottomSheet";
import { KeyValue } from "../ui/KeyValue";
import { ListRow } from "../ui/ListRow";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { SegmentedTabs } from "../ui/SegmentedTabs";
import { formatDate } from "../ui/dates";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useResource } from "../../../lib/manage/use-resource";
import { toQuery } from "../../../lib/manage/query";
import { colors, fonts } from "../../../constants/theme";
import { TONES } from "./common";
import type { LoyaltyBalance, LoyaltyTransaction } from "./loyalty-types";

const TXN_LABEL: Record<string, string> = { EARN: "Earned", REDEEM: "Redeemed", REVERSAL: "Reversal", ADJUSTMENT: "Adjustment" };
const MODES = [{ value: "add", label: "Add points" }, { value: "deduct", label: "Deduct points" }];

interface Props {
  customer: LoyaltyBalance | null;
  organizationId?: string;
  onClose: () => void;
  onAdjusted: () => void;
}

export function LoyaltyCustomerSheet({ customer, organizationId, onClose, onAdjusted }: Props) {
  const [adjusting, setAdjusting] = useState(false);
  const close = () => { setAdjusting(false); onClose(); };
  return (
    <BottomSheet flush scrollable visible={!!customer} title={customer?.user.name ?? "Customer"} onClose={close}>
      {customer ? (adjusting
        ? <AdjustForm customer={customer} organizationId={organizationId} onCancel={() => setAdjusting(false)} onDone={() => { setAdjusting(false); onAdjusted(); onClose(); }} />
        : <History customer={customer} organizationId={organizationId} onAdjust={() => setAdjusting(true)} />) : null}
    </BottomSheet>
  );
}

function History({ customer, organizationId, onAdjust }: { customer: LoyaltyBalance; organizationId?: string; onAdjust: () => void }) {
  const { data, loading } = useResource<{ transactions: LoyaltyTransaction[] }>(`/api/v1/loyalty/customers/${customer.userId}${toQuery({ organizationId })}`);
  return (
    <View style={styles.body}>
      <KeyValue label="Balance" value={`${customer.points} points`} emphasis />
      <KeyValue label="Total earned" value={customer.totalEarned} />
      <KeyValue label="Total redeemed" value={customer.totalRedeemed} />
      <Button label="Adjust points" icon="create-outline" onPress={onAdjust} style={styles.adjust} />
      <Text style={styles.section}>History</Text>
      {loading ? <Text style={styles.muted}>Loading...</Text> : null}
      {!loading && (data?.transactions.length ?? 0) === 0 ? <Text style={styles.muted}>No transactions yet</Text> : null}
      <View style={styles.list}>
        {data?.transactions.slice(0, 20).map((t) => (
          <ListRow
            key={t.id}
            title={t.description ?? TXN_LABEL[t.type]}
            subtitle={`${TXN_LABEL[t.type]} · balance ${t.balanceAfter}`}
            caption={formatDate(t.createdAt, true)}
            railColor={t.points > 0 ? TONES.green.color : TONES.violet.color}
            value={t.points > 0 ? `+${t.points}` : String(t.points)}
          />
        ))}
      </View>
    </View>
  );
}

interface AdjustProps {
  customer: LoyaltyBalance;
  organizationId?: string;
  onCancel: () => void;
  onDone: () => void;
}

function AdjustForm({ customer, organizationId, onCancel, onDone }: AdjustProps) {
  const { run, running } = useAction();
  const [mode, setMode] = useState("add");
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{ points?: string; reason?: string }>({});

  const submit = async () => {
    const n = Number(points);
    const found: typeof errors = {};
    if (!Number.isInteger(n) || n <= 0) found.points = "Enter a whole number above 0";
    if (!reason.trim()) found.reason = "Give a reason";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const signed = mode === "add" ? n : -n;
    const res = await run(() => api.post(`/api/v1/loyalty/adjust${toQuery({ organizationId })}`, { userId: customer.userId, points: signed, description: reason.trim() }), "Points adjusted");
    if (res) onDone();
  };

  return (
    <View style={styles.body}>
      <KeyValue label="Current balance" value={`${customer.points} points`} />
      <SegmentedTabs options={MODES} value={mode} onChange={setMode} />
      <View style={styles.fields}>
        <TextField label="Points" required value={points} onChangeText={setPoints} keyboardType="number-pad" error={errors.points} />
        <TextField label="Reason" required value={reason} onChangeText={setReason} multiline placeholder="e.g. Bonus for referral, correction for duplicate entry" error={errors.reason} />
      </View>
      <View style={styles.buttons}>
        <Button label="Back" variant="secondary" onPress={onCancel} style={styles.flex} />
        <Button label="Apply" onPress={submit} loading={running} style={styles.flex} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingBottom: 16 },
  adjust: { marginTop: 8 },
  section: { fontFamily: fonts.bold, fontSize: 11, color: colors.textSecondary, letterSpacing: 0.9, textTransform: "uppercase", marginTop: 18, marginBottom: 6 },
  muted: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary },
  list: { marginHorizontal: -16 },
  fields: { marginTop: 14 },
  buttons: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
});
