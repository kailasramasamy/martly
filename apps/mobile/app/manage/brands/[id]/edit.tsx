import { useLocalSearchParams } from "expo-router";
import { can } from "@martly/shared/permissions";
import { useAuth } from "../../../../lib/auth-context";
import { EmptyState } from "../../../../components/manage/ui/EmptyState";
import { BrandForm } from "../../../../components/manage/taxonomy/BrandForm";

export default function EditBrandScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  if (!can(user, "brands", "edit")) {
    return <EmptyState icon="lock-closed-outline" title="No access" message="Only Super Admins can edit brands." />;
  }
  return <BrandForm brandId={id} />;
}
