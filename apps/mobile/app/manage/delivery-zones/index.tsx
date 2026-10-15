import { Switch } from "react-native";
import { useRouter } from "expo-router";
import { can } from "@martly/shared/permissions";
import { colors } from "../../../constants/theme";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { useManageScope } from "../../../lib/manage-scope-context";
import { useAction } from "../../../lib/manage/use-action";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { ManageListScreen } from "../../../components/manage/ManageListScreen";
import { HeaderAction } from "../../../components/manage/HeaderAction";
import { ListRow } from "../../../components/manage/ui/ListRow";
import { manage, formatINR } from "../../../components/manage/ui/tokens";
import { ScreenNotice } from "../../../components/manage/delivery-config/ScreenNotice";
import type { DeliveryZone } from "../../../components/manage/delivery-config/types";

function describe(zone: DeliveryZone): string {
  const pins = zone.pincodes.length ? `${zone.pincodes.length} pincode${zone.pincodes.length === 1 ? "" : "s"}` : "No pincodes";
  return `${pins} · ${formatINR(zone.deliveryFee)} · ${zone.estimatedMinutes} min`;
}

export default function DeliveryZonesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { storeId } = useManageScope();
  const { run } = useAction();
  const role = user?.role ?? "";
  const allowed = can(role, "delivery-zones", "list");
  const list = usePagedList<DeliveryZone>("/api/v1/delivery-zones", {}, { pageSize: 50, enabled: allowed });
  const zones = { ...list, items: storeId ? list.items.filter((z) => z.stores.some((s) => s.store.id === storeId)) : list.items };

  const toggle = async (zone: DeliveryZone, isActive: boolean) => {
    const saved = await run(() => api.put(`/api/v1/delivery-zones/${zone.id}`, { isActive }));
    if (saved) list.updateItem(zone.id, { isActive });
  };

  if (!allowed) return <ScreenNotice title="Delivery zones" kind="denied" />;
  return (
    <ManageListScreen
      title="Delivery zones"
      list={zones}
      headerRight={can(role, "delivery-zones", "create") ? () => <HeaderAction accessibilityLabel="Add zone" onPress={() => router.push("/manage/delivery-zones/new")} /> : undefined}
      empty={{ icon: "map-outline", title: "No delivery zones", message: storeId ? "No zone covers the selected store." : "Add pincode-based zones with their own fee." }}
      renderItem={(zone) => (
        <ListRow
          title={zone.name}
          subtitle={describe(zone)}
          caption={zone.stores.map((s) => s.store.name).join(", ") || "No stores linked"}
          railColor={zone.isActive ? colors.primary : manage.muted}
          trailing={<Switch value={zone.isActive} disabled={!can(role, "delivery-zones", "edit")} onValueChange={(v) => toggle(zone, v)} trackColor={{ true: colors.primary, false: manage.line }} />}
          onPress={() => router.push(`/manage/delivery-zones/${zone.id}`)}
        />
      )}
    />
  );
}
