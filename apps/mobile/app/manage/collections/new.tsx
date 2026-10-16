import { can } from "@martly/shared/permissions";
import { useAuth } from "../../../lib/auth-context";
import { EmptyState } from "../../../components/manage/ui/EmptyState";
import { CollectionForm } from "../../../components/manage/collections/CollectionForm";

export default function NewCollectionScreen() {
  const { user } = useAuth();
  if (!can(user, "collections", "create")) {
    return <EmptyState icon="lock-closed-outline" title="No access" message="Only admins can create collections." />;
  }
  return <CollectionForm />;
}
