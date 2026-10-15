import { useResource } from "../../../lib/manage/use-resource";
import type { DepartmentNode } from "./types";

export function useTaxonomy() {
  const { data, loading, error, reload } = useResource<DepartmentNode[]>("/api/v1/categories/tree");
  return { tree: data ?? [], loading, error, reload };
}
