import { useAuth } from "../../../lib/auth-context";
import { ScreenNotice } from "../../../components/manage/delivery-config/ScreenNotice";
import { GlossaryList } from "../../../components/manage/platform/glossary/GlossaryList";

export default function GlossaryRoute() {
  const { user } = useAuth();
  if (user?.role !== "SUPER_ADMIN") return <ScreenNotice title="List glossary" kind="denied" />;
  return <GlossaryList />;
}
