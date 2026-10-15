import { useLocalSearchParams } from "expo-router";
import { can } from "@martly/shared/permissions";
import { useAuth } from "../../../lib/auth-context";
import { useResource } from "../../../lib/manage/use-resource";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { RecipeForm } from "../../../components/manage/recipes/RecipeForm";
import { RecipeView } from "../../../components/manage/recipes/RecipeView";
import type { RecipeDetail } from "../../../components/manage/recipes/types";

export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data, loading, error, reload } = useResource<RecipeDetail>(`/api/v1/recipes/${id}`);
  const owned = user?.role === "SUPER_ADMIN" || (!!data && data.organizationId === user?.organizationId);

  if (data && owned && can(user?.role ?? "", "recipes", "edit")) return <RecipeForm recipe={data} />;
  return (
    <ManageStackScreen title={data?.title ?? "Recipe"} loading={loading} error={error} onRetry={reload}>
      {data && <RecipeView recipe={data} />}
    </ManageStackScreen>
  );
}
