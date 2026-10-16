import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { StockMovementTypeLabels } from "@martly/shared/constants";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { BottomSheet } from "../../search/BottomSheet";
import { Button } from "../ui/Button";
import { SelectField } from "../ui/SelectField";
import { SegmentedTabs } from "../ui/SegmentedTabs";
import { TextField } from "../ui/TextField";

type AdjustType = "DAMAGE" | "EXPIRY" | "MANUAL";
type Direction = "remove" | "add";

const TYPE_OPTIONS = (["DAMAGE", "EXPIRY", "MANUAL"] as const).map((t) => ({ value: t, label: StockMovementTypeLabels[t] }));
const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: "remove", label: "Remove" },
  { value: "add", label: "Add" },
];

interface AdjustStockSheetProps {
  visible: boolean;
  storeProductId: string;
  currentStock: number;
  onClose: () => void;
  onAdjusted: () => void;
}

/** Write off damaged or expired units, or correct the count up or down; a note is mandatory */
export function AdjustStockSheet({ visible, storeProductId, currentStock, onClose, onAdjusted }: AdjustStockSheetProps) {
  const { run, running } = useAction();
  const [type, setType] = useState<AdjustType>("DAMAGE");
  const [direction, setDirection] = useState<Direction>("remove");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => {
    if (visible) { setType("DAMAGE"); setDirection("remove"); setAmount(""); setNote(""); }
  }, [visible]);

  // Damage and expiry can only take stock out
  const dir: Direction = type === "MANUAL" ? direction : "remove";
  const qty = Number(amount);
  const after = currentStock + (dir === "add" ? qty : -qty);
  const amountError = amount !== "" && (!Number.isInteger(qty) || qty <= 0) ? "Enter a whole number above 0" : undefined;
  const blocked = !qty || !!amountError || !note.trim();

  const submit = async () => {
    const body = { storeProductId, type, quantity: dir === "add" ? qty : -qty, note: note.trim() };
    const done = await run(() => api.post("/api/v1/stock/adjust", body), "Stock adjusted");
    if (!done) return;
    onAdjusted();
    onClose();
  };

  return (
    <BottomSheet scrollable visible={visible} title="Adjust stock" onClose={onClose}
      footer={<Button label="Apply adjustment" onPress={submit} loading={running} disabled={blocked} />}>
      <View style={styles.body}>
        <SelectField label="Reason" value={type} options={TYPE_OPTIONS} onChange={(v) => setType(v as AdjustType)} />
        {type === "MANUAL" && <SegmentedTabs options={DIRECTIONS} value={direction} onChange={setDirection} />}
        <TextField label="Quantity" required keyboardType="number-pad" value={amount} error={amountError}
          onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ""))}
          hint={qty > 0 ? `${currentStock} → ${after} on hand` : `${currentStock} on hand now`} />
        <TextField label="Note" required multiline maxLength={500} value={note} onChangeText={setNote} placeholder="What happened?" />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({ body: { gap: 14, paddingBottom: 8 } });
