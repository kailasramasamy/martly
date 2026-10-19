import { useLocalSearchParams } from "expo-router";
import { can } from "@martly/shared/permissions";
import { useAuth } from "../../../lib/auth-context";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { EmptyState } from "../../../components/manage/ui/EmptyState";
import { SectionForm } from "../../../components/manage/home-layout/SectionForm";
import { useHomeLayout } from "../../../components/manage/home-layout/use-home-layout";

export default function EditSectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data, loading, error, reload } = useHomeLayout().layout;
  const section = data?.isDefault ? undefined : data?.sections.find((s) => s.id === id);

  if (section && can(user, "home-layout", "edit")) return <SectionForm section={section} />;
  return (
    <ManageStackScreen title="Section" loading={loading} error={error} onRetry={reload}>
      <EmptyState icon="lock-closed-outline" title={section ? "No access" : "Section not found"} message={section ? "Only admins can edit Home sections." : "It may have been removed. Customize the layout from the list first."} />
    </ManageStackScreen>
  );
}
