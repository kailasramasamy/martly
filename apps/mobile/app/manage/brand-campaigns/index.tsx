import { useAuth } from "../../../lib/auth-context";
import { ScreenNotice } from "../../../components/manage/delivery-config/ScreenNotice";
import { CampaignList } from "../../../components/manage/platform/campaigns/CampaignList";

export default function BrandCampaignsScreen() {
  const { user } = useAuth();
  if (user?.role !== "SUPER_ADMIN") return <ScreenNotice title="Brand campaigns" kind="denied" />;
  return <CampaignList />;
}
