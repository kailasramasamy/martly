import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import type { CatalogDraftDetail } from "@martly/shared/types";
import { colors, fonts } from "../../../constants/theme";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { normalizeUnitType } from "../products/options";
import { Button } from "../ui/Button";
import { SectionCard } from "../ui/SectionCard";
import { formatINR, manage, tabular } from "../ui/tokens";
import { SizeList } from "./SizeList";
import { sizeError, toSizePayload, type SizeValues } from "./sizes";

interface PublishedSizesProps {
  draft: CatalogDraftDetail;
  onDone: (next: CatalogDraftDetail) => void;
}

function SizeRow({ size }: { size: CatalogDraftDetail["sizes"][number] }) {
  const listed = size.price !== null;
  return (
    <View style={styles.row}>
      <Text style={styles.name} numberOfLines={1}>{size.name}</Text>
      <Text style={[styles.meta, tabular]}>
        {listed ? `${formatINR(size.price as number)} · ${size.stock} in stock` : "Not listed here"}
      </Text>
    </View>
  );
}

/** The live product's sizes, and more added straight into this store's listing */
export function PublishedSizes({ draft, onDone }: PublishedSizesProps) {
  const [adding, setAdding] = useState<SizeValues[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const { run, running } = useAction();
  const unitType = draft.label ? normalizeUnitType(draft.label.unitType) : "";

  const save = async () => {
    if (adding.some((s) => sizeError(s))) return setShowErrors(true);
    const body = { sizes: adding.map(toSizePayload) };
    const next = await run(() => api.post<CatalogDraftDetail>(`/api/v1/catalog-drafts/${draft.id}/sizes`, body).then((r) => r.data), "Sizes added to the store");
    if (!next) return;
    setAdding([]);
    setShowErrors(false);
    onDone(next);
  };

  return (
    <SectionCard title="Sizes">
      {draft.sizes.map((s) => <SizeRow key={s.id} size={s} />)}
      <View style={styles.editor}>
        <SizeList sizes={adding} unitType={unitType} showErrors={showErrors} onChange={setAdding} />
        {adding.length > 0 && <Button label={adding.length === 1 ? "Save size" : `Save ${adding.length} sizes`} icon="checkmark" onPress={save} loading={running} style={styles.save} />}
      </View>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 44, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: manage.line },
  name: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  meta: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary },
  editor: { marginTop: 12 },
  save: { marginTop: 10 },
});
