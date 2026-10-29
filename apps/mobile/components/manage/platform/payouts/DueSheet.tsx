import { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { BottomSheet } from "../../../search/BottomSheet";
import { TextField } from "../../ui/TextField";
import { Button } from "../../ui/Button";
import { formatINR } from "../../ui/tokens";
import type { Due } from "./types";

interface Props {
  due: Due | null;
  running: boolean;
  onMarkPaid: (reference: string) => void;
  onCancelDue: () => void;
  onClose: () => void;
}

/** Settle a pending due with a bank reference, or cancel it */
export function DueSheet({ due, running, onMarkPaid, onCancelDue, onClose }: Props) {
  const [reference, setReference] = useState("");
  useEffect(() => setReference(""), [due]);

  return (
    <BottomSheet
      visible={!!due}
      title={due ? `${due.organizationName} · ${formatINR(due.amount, { decimals: true })}` : "Due"}
      onClose={onClose}
      scrollable
      footer={
        <View style={styles.footer}>
          <Button label="Mark paid" onPress={() => onMarkPaid(reference.trim())} disabled={reference.trim().length < 4} loading={running} />
          <Button label="Cancel this due" variant="danger" onPress={onCancelDue} disabled={running} />
        </View>
      }
    >
      <TextField label="Bank reference / UTR" value={reference} onChangeText={setReference} maxLength={40} autoCapitalize="characters" hint="At least 4 characters to mark it paid" />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  footer: { gap: 8 },
});
