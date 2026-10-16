import { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { BottomSheet } from "../../search/BottomSheet";
import { Button } from "../ui/Button";
import { SwitchRow } from "../ui/SwitchRow";
import { TextField } from "../ui/TextField";

interface RecountSheetProps {
  visible: boolean;
  selectedCount: number;
  /** Counted lines that are not selected and not yet applied */
  restCount: number;
  running: boolean;
  onClose: () => void;
  onConfirm: (note: string, approveRest: boolean) => void;
}

/** Last step before lines go back to the counter: optional note, and whether to approve the rest now */
export function RecountSheet({ visible, selectedCount, restCount, running, onClose, onConfirm }: RecountSheetProps) {
  const [note, setNote] = useState("");
  const [approveRest, setApproveRest] = useState(true);
  useEffect(() => {
    if (visible) { setNote(""); setApproveRest(true); }
  }, [visible]);

  return (
    <BottomSheet scrollable visible={visible} title={`Recount ${selectedCount} ${selectedCount === 1 ? "item" : "items"}`} onClose={onClose}
      footer={<Button label="Send for recount" onPress={() => onConfirm(note, approveRest)} loading={running} />}>
      <View style={styles.body}>
        <TextField label="Note (optional)" multiline maxLength={500} value={note} onChangeText={setNote} placeholder="What should they check?" />
        <SwitchRow label={`Approve the other ${restCount} ${restCount === 1 ? "line" : "lines"} now`}
          description="Their counted quantities are applied to stock straight away." value={approveRest} onValueChange={setApproveRest} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({ body: { gap: 14, paddingBottom: 8 } });
