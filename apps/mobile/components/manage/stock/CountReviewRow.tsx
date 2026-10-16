import { Text, StyleSheet } from "react-native";
import { colors, fonts } from "../../../constants/theme";
import { ListRow } from "../ui/ListRow";
import { StatusPill } from "../ui/StatusPill";
import { manage, tabular } from "../ui/tokens";
import { COUNT_STATUS, type StockCountItem } from "./types";

const SHORT = { color: "#b91c1c", bg: "#fee2e2" };
const OVER = { color: "#b45309", bg: "#fef3c7" };
const MATCH = { color: "#15803d", bg: "#dcfce7" };

function diffPill(diff: number) {
  if (diff === 0) return <StatusPill label="Match" {...MATCH} />;
  return <StatusPill label={`${diff > 0 ? "+" : ""}${diff}`} {...(diff < 0 ? SHORT : OVER)} />;
}

/** The counted figure leads; its label stays quiet */
function Counted({ qty }: { qty: number | null }) {
  if (qty === null) return <Text style={styles.label}>Not counted</Text>;
  return (
    <Text>
      <Text style={styles.label}>Counted </Text>
      <Text style={[styles.qty, tabular]}>{qty}</Text>
    </Text>
  );
}

interface CountReviewRowProps {
  item: StockCountItem;
  /** The count is waiting on a recount, so flagged lines say so */
  recounting?: boolean;
  /** Selection mode: undefined = not selecting; otherwise whether this line is ticked */
  selected?: boolean;
  onPress?: (item: StockCountItem) => void;
}

/** "System 12 · Applied · Corrected": only the parts the API sent for this viewer */
function caption(item: StockCountItem) {
  const parts: string[] = [];
  if (item.systemQty !== undefined && item.systemQty !== null) parts.push(`System ${item.systemQty}`);
  if (item.applied) parts.push("Applied");
  if (item.revisions?.some((r) => r.kind === "CORRECTION")) parts.push("Corrected");
  return parts.length ? parts.join(" \u00B7 ") : undefined;
}

/** Read-only count line; shows system stock and the difference only when the API sent them */
export function CountReviewRow({ item, recounting, selected, onPress }: CountReviewRowProps) {
  const diff = item.difference ?? null;
  return (
    <ListRow
      selected={selected}
      onPress={onPress ? () => onPress(item) : undefined}
      imageUrl={item.imageUrl}
      title={item.productName}
      subtitle={item.variantName}
      caption={caption(item)}
      railColor={diff ? (diff < 0 ? SHORT.color : OVER.color) : undefined}
      trailing={
        <>
          <Counted qty={item.countedQty} />
          {recounting && item.recountRequested ? <StatusPill {...COUNT_STATUS.RECOUNT} /> : null}
          {diff !== null && item.countedQty !== null ? diffPill(diff) : null}
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.medium, fontSize: 12.5, color: manage.muted },
  qty: { fontFamily: fonts.extrabold, fontSize: 19, color: colors.text },
});
