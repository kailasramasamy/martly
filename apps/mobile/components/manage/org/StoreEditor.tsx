import { useMemo, useState } from "react";
import { StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { can } from "@martly/shared/permissions";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { useManageScope } from "../../../lib/manage-scope-context";
import { useAction } from "../../../lib/manage/use-action";
import { useResource } from "../../../lib/manage/use-resource";
import { useToast } from "../../../lib/toast-context";
import { ManageStackScreen } from "../ManageStackScreen";
import { SectionCard } from "../ui/SectionCard";
import { KeyValue } from "../ui/KeyValue";
import { StatusPill } from "../ui/StatusPill";
import { Button } from "../ui/Button";
import { formatDate } from "../ui/dates";
import { DeleteAction } from "../delivery-config/DeleteAction";
import { StoreFormFields } from "./StoreFormFields";
import { StoreStaffSection } from "./StoreStaffSection";
import { STORE_STATUS } from "./constants";
import { buildStorePayload, draftFromStore, emptyDraft, type StoreDraft } from "./store-draft";
import type { OrganizationRow, StoreDetail } from "./types";

interface StoreEditorProps {
  /** Omit to create a store */
  store?: StoreDetail;
  onReload?: () => void;
}

function StoreSummary({ store }: { store: StoreDetail }) {
  const { stores } = useManageScope();
  return (
    <SectionCard title="Overview">
      <StatusPill {...STORE_STATUS[store.status]} dot />
      <KeyValue label="Organization" value={stores.find((s) => s.id === store.id)?.organizationName} />
      <KeyValue label="Created" value={formatDate(store.createdAt, true)} />
      <KeyValue label="Last updated" value={formatDate(store.updatedAt, true)} />
    </SectionCard>
  );
}

interface StoreExtrasProps {
  storeId: string;
  loading: boolean;
  onDelete: () => void;
}

function StoreExtras({ storeId, loading, onDelete }: StoreExtrasProps) {
  const router = useRouter();
  const { user } = useAuth();
  return (
    <>
      {can(user, "stores", "edit") && (
        <SectionCard title="Catalog">
          <Button label="Set up catalog" variant="secondary" icon="cube-outline" onPress={() => router.push(`/manage/onboard/${storeId}`)} />
        </SectionCard>
      )}
      {can(user, "users", "edit") && <StoreStaffSection storeId={storeId} />}
      {can(user, "stores", "delete") && (
        <SectionCard title="Danger zone">
          <DeleteAction
            title="Delete this store?"
            message="This removes the store and its configuration. Stores with orders or products can't be deleted; set the status to Closed instead."
            loading={loading}
            onConfirm={onDelete}
          />
        </SectionCard>
      )}
    </>
  );
}

export function StoreEditor({ store, onReload }: StoreEditorProps) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const { organizationId, refreshStores } = useManageScope();
  const { run, running } = useAction();
  const role = user?.role ?? "";
  const creating = !store;
  const initial = useMemo(() => (store ? draftFromStore(store) : emptyDraft(user?.organizationId ?? organizationId ?? "")), [store, user?.organizationId, organizationId]);
  const [draft, setDraft] = useState<StoreDraft>(initial);
  const orgs = useResource<OrganizationRow[]>(creating && role === "SUPER_ADMIN" ? "/api/v1/organizations?pageSize=100" : null);
  const set = (patch: Partial<StoreDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const save = async () => {
    const built = buildStorePayload(draft, creating, initial);
    if ("error" in built) return toast.show(built.error, "error");
    const saved = await run(
      () => (store ? api.put(`/api/v1/stores/${store.id}`, built.payload) : api.post<{ id: string }>("/api/v1/stores", built.payload)),
      creating ? "Store created" : "Store updated",
    );
    if (!saved) return;
    await refreshStores();
    if (creating) router.replace(`/manage/stores/${(saved.data as { id: string }).id}`);
    else onReload?.();
  };

  const remove = async () => {
    if (!store) return;
    const done = await run(() => api.delete(`/api/v1/stores/${store.id}`), "Store deleted");
    if (!done) return;
    await refreshStores();
    router.back();
  };

  const orgOptions = orgs.data?.map((o) => ({ value: o.id, label: o.name }));
  return (
    <ManageStackScreen
      title={store?.name ?? "New store"}
      actions={<Button label={creating ? "Create store" : "Save changes"} onPress={save} loading={running} style={styles.flex} />}
    >
      {store && <StoreSummary store={store} />}
      <StoreFormFields draft={draft} set={set} creating={creating} orgOptions={orgOptions} />
      {store && <StoreExtras storeId={store.id} loading={running} onDelete={remove} />}
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
