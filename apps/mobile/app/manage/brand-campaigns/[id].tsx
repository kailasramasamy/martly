import { useLocalSearchParams } from "expo-router";
import { useAuth } from "../../../lib/auth-context";
import { ScreenNotice } from "../../../components/manage/delivery-config/ScreenNotice";
import { CampaignDetail } from "../../../components/manage/platform/campaigns/CampaignDetail";

export default function BrandCampaignScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  if (user?.role !== "SUPER_ADMIN") return <ScreenNotice title="Campaign" kind="denied" />;
  return <CampaignDetail id={id} />;
}
