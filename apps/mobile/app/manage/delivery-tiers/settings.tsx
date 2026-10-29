import { useLocalSearchParams } from "expo-router";
import { ChargesForm } from "../../../components/manage/delivery-config/ChargesForm";

export default function DeliveryChargesSettingsScreen() {
  const { storeId } = useLocalSearchParams<{ storeId: string }>();
  return <ChargesForm storeId={storeId} />;
}
