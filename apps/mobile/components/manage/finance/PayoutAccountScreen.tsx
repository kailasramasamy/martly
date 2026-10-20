import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAuth } from "../../../lib/auth-context";
import { useResource } from "../../../lib/manage/use-resource";
import { colors, fonts } from "../../../constants/theme";
import { ManageStackScreen } from "../ManageStackScreen";
import { SectionCard } from "../ui/SectionCard";
import { StatusPill } from "../ui/StatusPill";
import { Button } from "../ui/Button";
import { accountLine } from "./format";
import { PayoutAccountSheet } from "./PayoutAccountSheet";
import type { PayoutAccount } from "../../../lib/ledger-types";

function Current({ account }: { account: PayoutAccount | null }) {
  if (!account) return <Text style={styles.muted}>No payout account yet. Payouts wait until you add one.</Text>;
  return (
    <View style={styles.current}>
      <Text style={styles.line} selectable>{accountLine(account)}</Text>
      <StatusPill label={account.verified ? "Verified" : "Awaiting verification"} color={account.verified ? "#15803d" : "#b45309"} bg={account.verified ? "#dcfce7" : "#fef3c7"} />
    </View>
  );
}

export function PayoutAccountScreen() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useResource<PayoutAccount | null>("/api/v1/ledger/payout-account");
  const [editing, setEditing] = useState(false);
  const canEdit = user?.role === "ORG_ADMIN";
  const account = data ?? null;

  return (
    <ManageStackScreen
      title="Payout account"
      loading={loading}
      error={error}
      onRetry={reload}
      actions={canEdit ? <Button label={account ? "Change account" : "Add account"} icon={account ? "create-outline" : "add"} onPress={() => setEditing(true)} style={{ flex: 1 }} /> : undefined}
    >
      <SectionCard title="Current account"><Current account={account} /></SectionCard>
      {canEdit ? null : <Text style={styles.muted}>Only the owner can change the payout account.</Text>}
      {editing ? (
        <PayoutAccountSheet account={account} visible onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />
      ) : null}
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  current: { gap: 8 },
  line: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  muted: { fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: colors.textSecondary },
});
