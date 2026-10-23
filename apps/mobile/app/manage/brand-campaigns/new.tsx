import { useLocalSearchParams } from "expo-router";
import { CampaignForm } from "../../../components/manage/platform/booking/CampaignForm";
import { ScreenNotice } from "../../../components/manage/delivery-config/ScreenNotice";
import { useAuth } from "../../../lib/auth-context";

export default function NewBrandCampaign() {
  const { user } = useAuth();
  const { startDate } = useLocalSearchParams<{ startDate?: string }>();
  if (user?.role !== "SUPER_ADMIN") return <ScreenNotice title="Book a campaign" kind="denied" />;
  return <CampaignForm campaign={null} startDate={startDate} />;
}
