import { Switch } from "react-native";
import { useRouter } from "expo-router";
import { can } from "@martly/shared/permissions";
import { colors } from "../../../constants/theme";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { useAction } from "../../../lib/manage/use-action";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { ManageListScreen } from "../../../components/manage/ManageListScreen";
import { HeaderAction } from "../../../components/manage/HeaderAction";
import { ListRow } from "../../../components/manage/ui/ListRow";
import { manage } from "../../../components/manage/ui/tokens";
import { ScreenNotice } from "../../../components/manage/delivery-config/ScreenNotice";
import { useStoreScope } from "../../../components/manage/StoreScope";
import { DAY_NAMES, type DeliverySlot } from "../../../components/manage/delivery-config/types";

export default function DeliverySlotsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { run } = useAction();
  const { storeId, picker, hasStores } = useStoreScope({ defaultFirst: true });
  const allowed = can(user, "delivery-slots", "list");
  const list = usePagedList<DeliverySlot>("/api/v1/delivery-slots", { storeId }, { pageSize: 100, enabled: !!storeId && allowed });

  const toggle = async (slot: DeliverySlot, isActive: boolean) => {
    const saved = await run(() => api.patch(`/api/v1/delivery-slots/${slot.id}`, { isActive }));
    if (saved) list.updateItem(slot.id, { isActive });
  };

  if (!allowed) return <ScreenNotice title="Delivery slots" kind="denied" />;
  if (!hasStores) return <ScreenNotice title="Delivery slots" kind="no-store" />;
  const addSlot = () => router.push(`/manage/delivery-slots/new?storeId=${storeId}`);
  return (
    <ManageListScreen
      title="Delivery slots"
      list={list}
      filters={picker}
      headerRight={can(user, "delivery-slots", "create") && storeId ? () => <HeaderAction accessibilityLabel="Add time slot" onPress={addSlot} /> : undefined}
      empty={{ icon: "time-outline", title: "No time slots", message: "Add delivery windows customers can book." }}
      renderItem={(slot) => (
        <ListRow
          title={`${DAY_NAMES[slot.dayOfWeek]}  ${slot.startTime} – ${slot.endTime}`}
          subtitle={`Up to ${slot.maxOrders} orders · cutoff ${slot.cutoffMinutes} min before`}
          railColor={slot.isActive ? colors.primary : manage.muted}
          trailing={<Switch value={slot.isActive} disabled={!can(user, "delivery-slots", "edit")} onValueChange={(v) => toggle(slot, v)} trackColor={{ true: colors.primary, false: manage.line }} />}
          onPress={() => router.push(`/manage/delivery-slots/${slot.id}?storeId=${slot.storeId}`)}
        />
      )}
    />
  );
}
