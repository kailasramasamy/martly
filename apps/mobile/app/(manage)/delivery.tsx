import { DispatcherDelivery } from "../../components/manage/delivery/plan/DispatcherDelivery";
import { RiderTrips } from "../../components/manage/rider/RiderTrips";
import { useDispatchAccess } from "../../components/manage/delivery/use-dispatch-access";

export default function ManageDeliveryScreen() {
  const { riderOnly } = useDispatchAccess();
  return riderOnly ? <RiderTrips /> : <DispatcherDelivery />;
}
