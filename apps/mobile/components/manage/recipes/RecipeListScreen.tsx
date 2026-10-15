import { useState } from "react";
import { useRouter } from "expo-router";
import { can } from "@martly/shared/permissions";
import { DifficultyLabels, FoodTypeLabels, type Difficulty, type FoodType } from "@martly/shared/constants";
import { useAuth } from "../../../lib/auth-context";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { ManageListScreen } from "../ManageListScreen";
import { HeaderAction } from "../HeaderAction";
import { ListRow } from "../ui/ListRow";
import { StatusPill } from "../ui/StatusPill";
import { manage } from "../ui/tokens";
import type { RecipeRecord } from "./types";

const ACTIVE = { label: "Active", color: "#15803d", bg: "#dcfce7" };
const INACTIVE = { label: "Inactive", color: "#475569", bg: "#f1f5f9" };

export function RecipeListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const list = usePagedList<RecipeRecord>("/api/v1/recipes", { q });
  const canCreate = can(user?.role ?? "", "recipes", "create");

  return (
    <ManageListScreen
      title="Recipes"
      list={list}
      search={{ value: q, onChange: setQ, placeholder: "Search recipes" }}
      headerRight={canCreate ? () => <HeaderAction onPress={() => router.push("/manage/recipes/new")} accessibilityLabel="New recipe" /> : undefined}
      empty={{ icon: "restaurant-outline", title: "No recipes yet", message: canCreate ? "Use + to add one." : undefined }}
      renderItem={(r) => (
        <ListRow
          title={r.title}
          subtitle={[r.cuisineType, r.difficulty ? DifficultyLabels[r.difficulty as Difficulty] : null, r.dietType ? FoodTypeLabels[r.dietType as FoodType] : null].filter(Boolean).join(" · ")}
          caption={`${r._count.items} ingredient${r._count.items === 1 ? "" : "s"}`}
          imageUrl={r.imageUrl}
          railColor={r.isActive ? undefined : manage.muted}
          trailing={<StatusPill {...(r.isActive ? ACTIVE : INACTIVE)} />}
          chevron
          onPress={() => router.push(`/manage/recipes/${r.id}`)}
        />
      )}
    />
  );
}
