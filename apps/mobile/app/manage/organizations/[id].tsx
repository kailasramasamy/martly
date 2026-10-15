import { useLocalSearchParams } from "expo-router";
import { useResource } from "../../../lib/manage/use-resource";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { OrganizationForm } from "../../../components/manage/org/OrganizationForm";
import type { OrganizationRow } from "../../../components/manage/org/types";

export default function EditOrganizationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const org = useResource<OrganizationRow>(`/api/v1/organizations/${id}`);
  if (!org.data) return <ManageStackScreen title="Organization" loading={org.loading} error={org.error} onRetry={org.reload}>{null}</ManageStackScreen>;
  return <OrganizationForm org={org.data} />;
}
