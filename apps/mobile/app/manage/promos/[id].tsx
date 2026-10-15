import { useLocalSearchParams } from "expo-router";
import { PromoDetailScreen } from "../../../components/manage/marketing/PromoDetailScreen";

export default function PromoDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PromoDetailScreen id={id} />;
}
