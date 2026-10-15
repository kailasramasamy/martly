import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { can } from "@martly/shared/permissions";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { useResource } from "../../../lib/manage/use-resource";
import { useAction } from "../../../lib/manage/use-action";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { HeaderAction } from "../../../components/manage/HeaderAction";
import { ConfirmDialog } from "../../../components/manage/ui/ConfirmDialog";
import { EmptyState } from "../../../components/manage/ui/EmptyState";
import { RiderForm, type RiderValues } from "../../../components/manage/delivery/RiderForm";
import type { Rider } from "../../../components/manage/delivery/types";

export default function EditRiderScreen() {
  const { id, storeId } = useLocalSearchParams<{ id: string; storeId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const role = user?.role ?? "";
  const { data, loading, error, reload, setData } = useResource<Rider[]>(`/api/v1/riders?storeId=${storeId}`);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { run, running } = useAction();
  const rider = data?.find((r) => r.id === id);

  if (!can(role, "riders", "edit")) {
    return <EmptyState icon="lock-closed-outline" title="No access" message="Only store managers and admins can edit riders." />;
  }

  const save = async (values: RiderValues) => {
    if (!rider) return;
    const changed: Partial<RiderValues> = {};
    if (values.name !== rider.name) changed.name = values.name;
    if (values.phone !== (rider.phone ?? "")) changed.phone = values.phone;
    if (values.email !== rider.email) changed.email = values.email;
    if (values.password) changed.password = values.password;
    const res = await run(() => api.put<Rider>(`/api/v1/riders/${id}?storeId=${storeId}`, changed), "Rider updated");
    if (res) setData((data ?? []).map((r) => (r.id === id ? { ...r, ...res.data } : r)));
  };

  const remove = async () => {
    const res = await run(() => api.delete(`/api/v1/riders/${id}?storeId=${storeId}`), "Rider removed");
    setConfirmDelete(false);
    if (res) router.back();
  };

  return (
    <ManageStackScreen
      title={rider?.name ?? "Rider"}
      loading={loading}
      error={error ?? (data && !rider ? "This rider no longer exists at this store" : null)}
      onRetry={reload}
      headerRight={can(role, "riders", "delete") ? () => <HeaderAction icon="trash-outline" accessibilityLabel="Remove rider" onPress={() => setConfirmDelete(true)} /> : undefined}
    >
      {rider && <RiderForm key={rider.id} rider={rider} saving={running} onSubmit={save} />}
      <ConfirmDialog
        visible={confirmDelete}
        title="Remove rider?"
        message={`${rider?.name ?? "This rider"} will lose access to this store. Riders on an active trip can't be removed.`}
        confirmLabel="Remove"
        running={running}
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      />
    </ManageStackScreen>
  );
}
