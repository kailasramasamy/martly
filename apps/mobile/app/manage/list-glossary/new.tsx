import { useAuth } from "../../../lib/auth-context";
import { ScreenNotice } from "../../../components/manage/delivery-config/ScreenNotice";
import { GlossaryForm } from "../../../components/manage/platform/glossary/GlossaryForm";

export default function NewGlossaryRoute() {
  const { user } = useAuth();
  if (user?.role !== "SUPER_ADMIN") return <ScreenNotice title="New glossary term" kind="denied" />;
  return <GlossaryForm />;
}
