import { useRouter } from "expo-router";
import { can } from "@martly/shared/permissions";
import { useAuth } from "../../../lib/auth-context";
import { ManageListScreen } from "../ManageListScreen";
import { HeaderAction } from "../HeaderAction";
import { ListRow } from "../ui/ListRow";
import { EmptyState } from "../ui/EmptyState";
import { CHILD_LEVEL } from "./paths";
import { findNode, type AnyNode } from "./find-node";
import { SubcategoryProducts } from "./SubcategoryProducts";
import { useTaxonomy } from "./use-taxonomy";
import type { CategoryNode, DepartmentNode, TaxonomyLevel } from "./types";

interface TaxonomyBrowserProps {
  /** The level whose children are listed; omit for the top-level departments */
  level?: TaxonomyLevel;
  id?: string;
}

function subtitle(itemLevel: TaxonomyLevel, node: AnyNode): string {
  if (itemLevel === "department") {
    const n = (node as DepartmentNode).categories.length;
    return `${n} ${n === 1 ? "category" : "categories"}`;
  }
  if (itemLevel === "category") {
    const n = (node as CategoryNode).subcategories.length;
    return `${n} ${n === 1 ? "subcategory" : "subcategories"}`;
  }
  return "";
}

export function TaxonomyBrowser({ level, id }: TaxonomyBrowserProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { tree, loading, error, reload } = useTaxonomy();
  const canWrite = can(user?.role ?? "", "categories", "create");
  const found = level && id ? findNode(tree, level, id) : null;
  const itemLevel = level ? CHILD_LEVEL[level] : "department";
  const items = level ? found?.children ?? [] : tree;

  if (level === "subcategory" && id) return <SubcategoryProducts id={id} name={found?.node.name} path={found?.path} canWrite={canWrite} />;
  if (!loading && level && !found && !error) {
    return <EmptyState icon="alert-circle-outline" title="Not found" message="This item no longer exists." />;
  }

  const open = (node: AnyNode) => itemLevel && router.push(`/manage/categories/${node.id}?level=${itemLevel}`);
  const headerRight = canWrite
    ? () => (
        <>
          {found && level && <HeaderAction icon="create-outline" onPress={() => router.push(`/manage/categories/${id}/edit?level=${level}`)} accessibilityLabel="Edit" />}
          {itemLevel && <HeaderAction onPress={() => router.push(`/manage/categories/new?level=${itemLevel}${id ? `&parentId=${id}` : ""}`)} accessibilityLabel="Add" />}
        </>
      )
    : undefined;

  return (
    <ManageListScreen
      title={found?.node.name ?? "Categories"}
      list={{ items, loading, refreshing: false, loadingMore: false, error, refresh: reload, loadMore: () => undefined }}
      headerRight={headerRight}
      empty={{ icon: "file-tray-stacked-outline", title: "Nothing here yet", message: canWrite ? "Use + to add one." : undefined }}
      renderItem={(node) => (
        <ListRow title={node.name} subtitle={itemLevel ? subtitle(itemLevel, node) : ""} imageUrl={node.imageUrl} chevron onPress={() => open(node)} />
      )}
    />
  );
}
