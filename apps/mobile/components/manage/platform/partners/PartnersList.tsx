import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "../../../../lib/api";
import { useAction } from "../../../../lib/manage/use-action";
import { useResource } from "../../../../lib/manage/use-resource";
import { colors } from "../../../../constants/theme";
import { ManageListScreen } from "../../ManageListScreen";
import { HeaderAction } from "../../HeaderAction";
import { ListRow } from "../../ui/ListRow";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { TONES } from "../../marketing/common";
import type { BrandPartner } from "../types";

const dateOf = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function PartnersList() {
  const router = useRouter();
  const { data, loading, error, reload } = useResource<BrandPartner[]>("/api/v1/brand-campaigns/partners");
  const { run, running } = useAction();
  const [removing, setRemoving] = useState<BrandPartner | null>(null);
  const list = { items: data ?? [], loading, refreshing: false, loadingMore: false, error, refresh: reload, loadMore: () => undefined };

  const remove = async () => {
    if (!removing) return;
    const done = await run(() => api.delete(`/api/v1/brand-campaigns/partners/${removing.id}`), "Login removed");
    setRemoving(null);
    if (done) reload();
  };

  return (
    <>
      <ManageListScreen
        title="Brand partners"
        list={list}
        headerRight={() => <HeaderAction accessibilityLabel="New brand login" onPress={() => router.push("/manage/brand-partners/new")} />}
        empty={{ icon: "people-outline", title: "No brand logins", message: "Create a login so a brand can run its own campaigns." }}
        renderItem={(p) => (
          <ListRow
            title={p.name}
            subtitle={p.email}
            caption={`${p.brand?.name ?? "No brand"} · Added ${dateOf(p.createdAt)}`}
            status={p.deletedAt ? { label: "Removed", ...TONES.slate } : undefined}
            trailing={p.deletedAt ? undefined : <Ionicons name="trash-outline" size={20} color={colors.error} />}
            onPress={p.deletedAt ? undefined : () => setRemoving(p)}
          />
        )}
      />
      <ConfirmDialog
        visible={!!removing}
        title="Remove this login?"
        message="Removing stops their logins; the brand's campaigns and invoices stay."
        confirmLabel="Remove"
        running={running}
        onConfirm={remove}
        onClose={() => setRemoving(null)}
      />
    </>
  );
}
