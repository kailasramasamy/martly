import { useLocalSearchParams } from "expo-router";
import { TierForm } from "../../../components/manage/delivery-config/TierForm";

export default function NewDeliveryTierScreen() {
  const { storeId } = useLocalSearchParams<{ storeId: string }>();
  return <TierForm storeId={storeId} />;
}
