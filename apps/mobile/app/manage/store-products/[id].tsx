import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { can } from "@martly/shared/permissions";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { useResource } from "../../../lib/manage/use-resource";
import { useAction } from "../../../lib/manage/use-action";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { HeaderAction } from "../../../components/manage/HeaderAction";
import { ConfirmDialog } from "../../../components/manage/ui/ConfirmDialog";
import { Button } from "../../../components/manage/ui/Button";
import { EmptyState } from "../../../components/manage/ui/EmptyState";
import { buildUpdatePayload, draftFromItem, type StoreProductDraft } from "../../../components/manage/inventory/draft";
import { StoreProductForm } from "../../../components/manage/inventory/StoreProductForm";
import type { StoreProductItem } from "../../../components/manage/inventory/types";
import { StockAdjustSection } from "../../../components/manage/stock/StockAdjustSection";
import { useListingAccess } from "../../../components/manage/inventory/use-listing-access";
import { useToast } from "../../../lib/toast-context";

export default function StoreProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const { data, setData, loading, error, reload } = useResource<StoreProductItem>(`/api/v1/store-products/${id}`);
  const [draft, setDraft] = useState<StoreProductDraft | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const { run, running } = useAction();
  const access = useListingAccess();

  useEffect(() => {
    if (data) setDraft(draftFromItem(data));
  }, [data]);

  if (!can(user, "store-products", "show")) {
    return <EmptyState icon="lock-closed-outline" title="No access" message="Your role can't view store inventory." />;
  }
  const canEdit = Object.values(access).some(Boolean);
  const canRemove = can(user, "store-products", "delete");

  const save = async () => {
    if (!draft) return;
    const built = buildUpdatePayload(draft, access);
    if ("error" in built) return toast.show(built.error, "error");
    const res = await run(() => api.put<StoreProductItem>(`/api/v1/store-products/${id}`, built.payload), "Saved");
    if (res) setData(res.data);
  };

  const remove = async () => {
    const done = await run(() => api.delete(`/api/v1/store-products/${id}`), "Removed from store");
    setConfirmRemove(false);
    if (done) router.back();
  };

  return (
    <ManageStackScreen
      title="Edit listing"
      loading={loading}
      error={error}
      onRetry={reload}
      headerRight={canRemove ? () => <HeaderAction icon="trash-outline" accessibilityLabel="Remove from store" onPress={() => setConfirmRemove(true)} /> : undefined}
      actions={canEdit ? <Button label="Save changes" onPress={save} loading={running} style={{ flex: 1 }} /> : undefined}
    >
      {data && draft && <StoreProductForm item={data} draft={draft} access={access} onChange={(p) => setDraft({ ...draft, ...p })} />}
      {data && <StockAdjustSection storeProductId={data.id} currentStock={data.stock} onChanged={reload} />}
      <ConfirmDialog
        visible={confirmRemove}
        title="Remove from store?"
        message="This product will no longer be sold at this store. Past orders are unaffected."
        confirmLabel="Remove"
        running={running}
        onConfirm={remove}
        onClose={() => setConfirmRemove(false)}
      />
    </ManageStackScreen>
  );
}
