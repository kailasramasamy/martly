import { useLocalSearchParams } from "expo-router";
import { CompleteDelivery } from "../../../components/manage/rider/complete/CompleteDelivery";
import { toDateKey } from "../../../components/manage/ui/dates";

export default function CompleteDeliveryScreen() {
  const { orderId, date } = useLocalSearchParams<{ orderId: string; date?: string }>();
  return <CompleteDelivery orderId={orderId} date={date ?? toDateKey(new Date())} />;
}
