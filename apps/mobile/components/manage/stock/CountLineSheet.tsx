import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../../../constants/theme";
import { BottomSheet } from "../../search/BottomSheet";
import { Button } from "../ui/Button";
import { KeyValue } from "../ui/KeyValue";
import { TextField } from "../ui/TextField";
import { CountRevisions } from "./CountRevisions";
import type { StockCountItem } from "./types";

const MIN_REASON = 3;

interface CountLineSheetProps {
  item: StockCountItem | null;
  /** SUBMITTED and the line is not already applied to stock */
  canCorrect: boolean;
  running: boolean;
  onClose: () => void;
  onCorrect: (storeProductId: string, qty: number, reason: string) => Promise<boolean>;
}

function CorrectForm({ item, running, onCorrect }: Pick<CountLineSheetProps, "running" | "onCorrect"> & { item: StockCountItem }) {
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const reasonError = touched && reason.trim().length < MIN_REASON ? `Give a reason (at least ${MIN_REASON} characters)` : undefined;

  const save = () => {
    setTouched(true);
    if (qty === "" || reason.trim().length < MIN_REASON) return;
    onCorrect(item.storeProductId, Number(qty), reason.trim());
  };

  return (
    <View style={styles.form}>
      <Text style={styles.heading}>Correct count</Text>
      <TextField label="Correct quantity" required keyboardType="number-pad" value={qty}
        onChangeText={(t) => setQty(t.replace(/[^0-9]/g, ""))} />
      <TextField label="Reason" required multiline maxLength={300} value={reason} onChangeText={setReason} error={reasonError} placeholder="Why is the count changing?" />
      <Button label="Save correction" onPress={save} loading={running} disabled={qty === ""} />
    </View>
  );
}

/** One line in detail: the figures, who counted what, and (while reviewable) a way to fix the count */
export function CountLineSheet({ item, canCorrect, running, onClose, onCorrect }: CountLineSheetProps) {
  // Keep the last item mounted while the sheet animates out
  const [shown, setShown] = useState(item);
  useEffect(() => { if (item) setShown(item); }, [item]);
  if (!shown) return null;
  const diff = shown.difference;
  return (
    <BottomSheet scrollable visible={!!item} title={shown.productName} onClose={onClose}>
      <View style={styles.body}>
        <Text style={styles.variant}>{shown.variantName}</Text>
        <View>
          <KeyValue label="Counted" value={shown.countedQty} />
          <KeyValue label="System" value={shown.systemQty} />
          <KeyValue label="Difference" value={diff === null || diff === undefined ? null : `${diff > 0 ? "+" : ""}${diff}`} />
        </View>
        {shown.revisions?.length ? <CountRevisions revisions={shown.revisions} /> : null}
        {canCorrect && <CorrectForm key={`${shown.storeProductId}-${shown.revisions?.length ?? 0}`} item={shown} running={running} onCorrect={onCorrect} />}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 16, paddingBottom: 8 },
  variant: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  form: { gap: 12 },
  heading: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
});
