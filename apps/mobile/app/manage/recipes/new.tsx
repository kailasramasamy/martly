import { can } from "@martly/shared/permissions";
import { useAuth } from "../../../lib/auth-context";
import { EmptyState } from "../../../components/manage/ui/EmptyState";
import { RecipeForm } from "../../../components/manage/recipes/RecipeForm";

export default function NewRecipeScreen() {
  const { user } = useAuth();
  if (!can(user, "recipes", "create")) {
    return <EmptyState icon="lock-closed-outline" title="No access" message="Only admins can create recipes." />;
  }
  return <RecipeForm />;
}
