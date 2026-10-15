import { useLocalSearchParams } from "expo-router";
import { CampaignDetail } from "../../../../components/manage/marketing/notifications/CampaignDetail";

export default function CampaignDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CampaignDetail id={id} />;
}
