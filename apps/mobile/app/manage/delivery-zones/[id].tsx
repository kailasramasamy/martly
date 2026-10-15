import { useLocalSearchParams } from "expo-router";
import { useResource } from "../../../lib/manage/use-resource";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { ZoneForm } from "../../../components/manage/delivery-config/ZoneForm";
import type { DeliveryZone } from "../../../components/manage/delivery-config/types";

export default function EditDeliveryZoneScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const zone = useResource<DeliveryZone>(`/api/v1/delivery-zones/${id}`);
  if (!zone.data) return <ManageStackScreen title="Delivery zone" loading={zone.loading} error={zone.error} onRetry={zone.reload}>{null}</ManageStackScreen>;
  return <ZoneForm zone={zone.data} />;
}
