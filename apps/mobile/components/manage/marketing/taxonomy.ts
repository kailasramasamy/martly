import { useMemo } from "react";
import type { SelectOption } from "../ui/SelectField";
import { useResource } from "../../../lib/manage/use-resource";

interface Node {
  id: string;
  name: string;
  categories?: Node[];
  subcategories?: Node[];
}

export type TaxonomyLevel = "departmentId" | "categoryId" | "subcategoryId";

export interface TaxonomyOption extends SelectOption {
  level: TaxonomyLevel;
  id: string;
}

/** Every department, category and subcategory flattened into "Dept > Cat > Sub" options (value is "level:id") */
export function useTaxonomyOptions() {
  const { data, loading } = useResource<Node[]>("/api/v1/categories/tree");
  const options = useMemo(() => {
    const out: TaxonomyOption[] = [];
    for (const d of data ?? []) {
      out.push({ value: `departmentId:${d.id}`, label: d.name, level: "departmentId", id: d.id });
      for (const c of d.categories ?? []) {
        out.push({ value: `categoryId:${c.id}`, label: `${d.name} › ${c.name}`, level: "categoryId", id: c.id });
        for (const s of c.subcategories ?? []) {
          out.push({ value: `subcategoryId:${s.id}`, label: `${d.name} › ${c.name} › ${s.name}`, level: "subcategoryId", id: s.id });
        }
      }
    }
    return out;
  }, [data]);
  return { options, loading };
}
