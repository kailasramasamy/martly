import { useLocalSearchParams } from "expo-router";
import { SubscriptionDetailScreen } from "../../../components/manage/marketing/SubscriptionDetailScreen";

export default function SubscriptionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SubscriptionDetailScreen id={id} />;
}
