import { useLocalSearchParams } from "expo-router";
import { useAuth } from "../../../../lib/auth-context";
import { EmptyState } from "../../../../components/manage/ui/EmptyState";
import { BrandRankingScreen } from "../../../../components/manage/taxonomy/BrandRankingScreen";

export default function BrandRankingRoute() {
  const { id, level } = useLocalSearchParams<{ id: string; level?: string }>();
  const { user } = useAuth();
  if (user?.role !== "SUPER_ADMIN") {
    return <EmptyState icon="lock-closed-outline" title="No access" message="Only Super Admins can rank brands." />;
  }
  return <BrandRankingScreen id={id} level={level === "subcategory" ? "subcategory" : "category"} />;
}
