import { can } from "@martly/shared/permissions";
import { useAuth } from "../../../lib/auth-context";
import { EmptyState } from "../../../components/manage/ui/EmptyState";
import { SectionForm } from "../../../components/manage/home-layout/SectionForm";

export default function NewSectionScreen() {
  const { user } = useAuth();
  if (!can(user, "home-layout", "create")) {
    return <EmptyState icon="lock-closed-outline" title="No access" message="Only admins can add Home sections." />;
  }
  return <SectionForm />;
}
