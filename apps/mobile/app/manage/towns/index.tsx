import { useAuth } from "../../../lib/auth-context";
import { ScreenNotice } from "../../../components/manage/delivery-config/ScreenNotice";
import { TownsList } from "../../../components/manage/platform/towns/TownsList";

export default function TownsRoute() {
  const { user } = useAuth();
  if (user?.role !== "SUPER_ADMIN") return <ScreenNotice title="Towns" kind="denied" />;
  return <TownsList />;
}
