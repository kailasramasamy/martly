import { can } from "@martly/shared/permissions";
import { useAuth } from "../../../lib/auth-context";
import { ScreenNotice } from "../../../components/manage/delivery-config/ScreenNotice";
import { FleetScreen } from "../../../components/manage/fleet/FleetScreen";
import { useStoreScope } from "../../../components/manage/StoreScope";

export default function DeliveryFleetScreen() {
  const { user } = useAuth();
  const { storeId, picker, hasStores } = useStoreScope({ defaultFirst: true });

  if (!can(user, "delivery-fleet")) return <ScreenNotice title="Riders & trips" kind="denied" />;
  if (!storeId || !hasStores) return <ScreenNotice title="Riders & trips" kind="no-store" />;
  return <FleetScreen key={storeId} storeId={storeId} storeField={picker} />;
}
