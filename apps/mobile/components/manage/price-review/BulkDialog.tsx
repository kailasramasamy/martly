import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, fonts, radius } from "../../../constants/theme";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { manage, tabular } from "../ui/tokens";

export type BulkKind = "confirm" | "hide" | "percentOffMrp";

const PERCENTS = [0, 2, 3, 5, 8, 10, 15];

interface Props {
  kind: BulkKind | null;
  /** What's being settled, e.g. "Aashirvaad" */
  name: string;
  pending: number;
  running: boolean;
  onConfirm: (percent: number) => void;
  onClose: () => void;
}

const COPY: Record<BulkKind, { title: string; label: string; message: (name: string, n: number) => string }> = {
  confirm: { title: "Prices look right?", label: "Mark as checked", message: (name, n) => `${n} ${name} prices still waiting keep their current price and count as checked.` },
  hide: { title: "Not sold here?", label: "Hide products", message: (name, n) => `${n} ${name} products still waiting are taken off your shop. Customers won't see them; you can bring them back from Not sold.` },
  percentOffMrp: { title: "Price below MRP", label: "Apply", message: (name, n) => `${n} ${name} prices still waiting are set this far below their MRP, rounded to the rupee.` },
};

/** Confirms a brand- or aisle-wide action with its count; the % below MRP is picked here */
export function BulkDialog({ kind, name, pending, running, onConfirm, onClose }: Props) {
  const [percent, setPercent] = useState(5);
  const copy = kind ? COPY[kind] : COPY.confirm;
  return (
    <ConfirmDialog
      visible={kind !== null}
      title={copy.title}
      message={copy.message(name, pending)}
      confirmLabel={kind === "percentOffMrp" ? `Set ${percent}% below MRP` : copy.label}
      confirmVariant={kind === "hide" ? "danger" : "primary"}
      running={running}
      onConfirm={() => onConfirm(percent)}
      onClose={onClose}
    >
      {kind === "percentOffMrp" && (
        <View style={styles.row}>
          {PERCENTS.map((p) => (
            <TouchableOpacity key={p} style={[styles.chip, p === percent && styles.chipActive]} onPress={() => setPercent(p)} accessibilityRole="button" accessibilityState={{ selected: p === percent }}>
              <Text style={[styles.chipText, tabular, p === percent && styles.chipTextActive]}>{p === 0 ? "MRP" : `${p}%`}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ConfirmDialog>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chip: { minWidth: 56, height: 44, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: manage.line, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  chipTextActive: { color: "#fff" },
});
