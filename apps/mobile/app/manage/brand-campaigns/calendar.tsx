import { CampaignCalendar } from "../../../components/manage/platform/calendar/CampaignCalendar";
import { ScreenNotice } from "../../../components/manage/delivery-config/ScreenNotice";
import { useAuth } from "../../../lib/auth-context";

export default function CampaignCalendarScreen() {
  const { user } = useAuth();
  if (user?.role !== "SUPER_ADMIN") return <ScreenNotice title="Campaign calendar" kind="denied" />;
  return <CampaignCalendar />;
}
