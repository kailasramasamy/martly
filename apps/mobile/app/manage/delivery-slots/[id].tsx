import { useLocalSearchParams } from "expo-router";
import { useResource } from "../../../lib/manage/use-resource";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { SlotForm } from "../../../components/manage/delivery-config/SlotForm";
import type { DeliverySlot } from "../../../components/manage/delivery-config/types";

export default function EditDeliverySlotScreen() {
  const { id, storeId } = useLocalSearchParams<{ id: string; storeId: string }>();
  const slots = useResource<DeliverySlot[]>(`/api/v1/delivery-slots?storeId=${storeId}&pageSize=200`);
  const slot = slots.data?.find((s) => s.id === id);
  if (!slot) return <ManageStackScreen title="Time slot" loading={slots.loading} error={slots.error ?? (slots.data ? "This slot no longer exists" : null)} onRetry={slots.reload}>{null}</ManageStackScreen>;
  return <SlotForm storeId={slot.storeId} slot={slot} />;
}
