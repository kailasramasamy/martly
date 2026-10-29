import { useLocalSearchParams } from "expo-router";
import { useAuth } from "../../../lib/auth-context";
import { ScreenNotice } from "../../../components/manage/delivery-config/ScreenNotice";
import { GlossaryForm } from "../../../components/manage/platform/glossary/GlossaryForm";

export default function EditGlossaryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  if (user?.role !== "SUPER_ADMIN") return <ScreenNotice title="Glossary term" kind="denied" />;
  return <GlossaryForm id={id} />;
}
