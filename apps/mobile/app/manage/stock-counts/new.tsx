import { useState } from "react";
import { useRouter } from "expo-router";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { SectionCard } from "../../../components/manage/ui/SectionCard";
import { TextField } from "../../../components/manage/ui/TextField";
import { Button } from "../../../components/manage/ui/Button";
import { EmptyState } from "../../../components/manage/ui/EmptyState";
import { useStoreScope } from "../../../components/manage/StoreScope";
import { TaxonomyPicker } from "../../../components/manage/taxonomy/TaxonomyPicker";
import { useTaxonomy } from "../../../components/manage/taxonomy/use-taxonomy";
import { EMPTY_SELECTION, type TaxonomySelection } from "../../../components/manage/taxonomy/types";
import type { StockCountDetail } from "../../../components/manage/stock/types";
import { useStockAccess } from "../../../components/manage/stock/use-stock-access";

export default function NewStockCountScreen() {
  const router = useRouter();
  const { canCount } = useStockAccess();
  const { storeId, picker } = useStoreScope({ required: true, placeholder: "Choose the store to count" });
  const { tree, loading, error, reload } = useTaxonomy();
  const [aisle, setAisle] = useState<TaxonomySelection>(EMPTY_SELECTION);
  const [note, setNote] = useState("");
  const { run, running } = useAction();

  if (!canCount) return <EmptyState icon="lock-closed-outline" title="No access" message="Your role can't start stock counts." />;

  const start = async () => {
    const res = await run(() => api.post<StockCountDetail>("/api/v1/stock/counts", {
      storeId, subcategoryId: aisle.subcategoryId, ...(note.trim() ? { note: note.trim() } : {}),
    }));
    if (res) router.replace(`/manage/stock-counts/${res.data.id}`);
  };

  return (
    <ManageStackScreen
      title="New stock count"
      loading={loading}
      error={error}
      onRetry={reload}
      actions={<Button label="Start counting" onPress={start} loading={running} disabled={!storeId || !aisle.subcategoryId} style={{ flex: 1 }} />}
    >
      {picker}
      <SectionCard title="Aisle">
        <TaxonomyPicker tree={tree} value={aisle} onChange={setAisle} required />
      </SectionCard>
      <TextField label="Note (optional)" value={note} onChangeText={setNote} multiline maxLength={500} placeholder="e.g. Month-end audit" />
    </ManageStackScreen>
  );
}
