import { useAuth } from "../../../lib/auth-context";
import { ScreenNotice } from "../../../components/manage/delivery-config/ScreenNotice";
import { PlansList } from "../../../components/manage/platform/revenue/PlansList";

export default function StorePlansRoute() {
  const { user } = useAuth();
  if (user?.role !== "SUPER_ADMIN") return <ScreenNotice title="Store plans" kind="denied" />;
  return <PlansList />;
}
