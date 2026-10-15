import { can } from "@martly/shared/permissions";
import { useAuth } from "../../../lib/auth-context";
import { EmptyState } from "../../../components/manage/ui/EmptyState";
import { BrandForm } from "../../../components/manage/taxonomy/BrandForm";

export default function NewBrandScreen() {
  const { user } = useAuth();
  if (!can(user?.role ?? "", "brands", "create")) {
    return <EmptyState icon="lock-closed-outline" title="No access" message="Only Super Admins can add brands." />;
  }
  return <BrandForm />;
}
