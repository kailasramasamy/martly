import { useAuth } from "../../../lib/auth-context";
import { ScreenNotice } from "../../../components/manage/delivery-config/ScreenNotice";
import { PayoutsScreen } from "../../../components/manage/platform/payouts/PayoutsScreen";

export default function PlatformPayoutsRoute() {
  const { user } = useAuth();
  if (user?.role !== "SUPER_ADMIN") return <ScreenNotice title="Platform payouts" kind="denied" />;
  return <PayoutsScreen />;
}
