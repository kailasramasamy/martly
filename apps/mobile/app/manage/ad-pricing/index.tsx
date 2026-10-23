import { useAuth } from "../../../lib/auth-context";
import { ScreenNotice } from "../../../components/manage/delivery-config/ScreenNotice";
import { PricingScreen } from "../../../components/manage/platform/pricing/PricingScreen";

export default function AdPricingRoute() {
  const { user } = useAuth();
  if (user?.role !== "SUPER_ADMIN") return <ScreenNotice title="Ad pricing" kind="denied" />;
  return <PricingScreen />;
}
