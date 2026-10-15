import { useLocalSearchParams } from "expo-router";
import { useResource } from "../../../lib/manage/use-resource";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { TierForm } from "../../../components/manage/delivery-config/TierForm";
import type { DeliveryTier } from "../../../components/manage/delivery-config/types";

export default function EditDeliveryTierScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tier = useResource<DeliveryTier>(`/api/v1/delivery-tiers/${id}`);
  if (!tier.data) return <ManageStackScreen title="Delivery tier" loading={tier.loading} error={tier.error} onRetry={tier.reload}>{null}</ManageStackScreen>;
  return <TierForm storeId={tier.data.storeId} tier={tier.data} />;
}
