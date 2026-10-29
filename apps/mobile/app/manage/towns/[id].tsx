import { useLocalSearchParams } from "expo-router";
import { useAuth } from "../../../lib/auth-context";
import { ScreenNotice } from "../../../components/manage/delivery-config/ScreenNotice";
import { TownForm } from "../../../components/manage/platform/towns/TownForm";

export default function EditTownRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  if (user?.role !== "SUPER_ADMIN") return <ScreenNotice title="Town" kind="denied" />;
  return <TownForm id={id} />;
}
