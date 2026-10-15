import { useLocalSearchParams } from "expo-router";
import { SlotForm } from "../../../components/manage/delivery-config/SlotForm";

export default function NewDeliverySlotScreen() {
  const { storeId } = useLocalSearchParams<{ storeId: string }>();
  return <SlotForm storeId={storeId} />;
}
