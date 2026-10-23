import { useAuth } from "../../../lib/auth-context";
import { ScreenNotice } from "../../../components/manage/delivery-config/ScreenNotice";
import { RevenueScreen } from "../../../components/manage/platform/revenue/RevenueScreen";

export default function MarketingRevenueRoute() {
  const { user } = useAuth();
  if (user?.role !== "SUPER_ADMIN") return <ScreenNotice title="Marketing revenue" kind="denied" />;
  return <RevenueScreen />;
}
