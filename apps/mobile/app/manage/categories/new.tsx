import { useLocalSearchParams } from "expo-router";
import { can } from "@martly/shared/permissions";
import { useAuth } from "../../../lib/auth-context";
import { EmptyState } from "../../../components/manage/ui/EmptyState";
import { TaxonomyForm } from "../../../components/manage/taxonomy/TaxonomyForm";
import { isTaxonomyLevel } from "../../../components/manage/taxonomy/paths";

export default function NewCategoryScreen() {
  const { level, parentId } = useLocalSearchParams<{ level?: string; parentId?: string }>();
  const { user } = useAuth();
  if (!can(user?.role ?? "", "categories", "create")) {
    return <EmptyState icon="lock-closed-outline" title="No access" message="Only Super Admins can change the category tree." />;
  }
  return <TaxonomyForm level={isTaxonomyLevel(level) ? level : "subcategory"} parentId={parentId} />;
}
