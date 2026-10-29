import { useAuth } from "../../../lib/auth-context";
import { ScreenNotice } from "../../../components/manage/delivery-config/ScreenNotice";
import { TownForm } from "../../../components/manage/platform/towns/TownForm";

export default function NewTownRoute() {
  const { user } = useAuth();
  if (user?.role !== "SUPER_ADMIN") return <ScreenNotice title="New town" kind="denied" />;
  return <TownForm />;
}
