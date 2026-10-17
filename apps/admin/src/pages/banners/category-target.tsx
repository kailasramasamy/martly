import { useEffect, useState } from "react";
import { Cascader, Form } from "antd";
import { axiosInstance } from "../../providers/data-provider";

interface SubcategoryNode { id: string; name: string; }
interface CategoryNode { id: string; name: string; subcategories: SubcategoryNode[]; }
interface DepartmentNode { id: string; name: string; categories: CategoryNode[]; }

export interface CascaderOption { value: string; label: string; children?: CascaderOption[]; }

function buildCascaderOptions(departments: DepartmentNode[]): CascaderOption[] {
  return departments.map((d) => ({
    value: d.id,
    label: d.name,
    children: d.categories.map((c) => ({
      value: c.id,
      label: c.name,
      children: c.subcategories.map((s) => ({ value: s.id, label: s.name })),
    })),
  }));
}

/** Department > category > subcategory options for the banner pickers */
export function useCategoryTree() {
  const [options, setOptions] = useState<CascaderOption[]>([]);
  useEffect(() => {
    axiosInstance.get("/categories/tree").then((res) => setOptions(buildCascaderOptions(res.data.data))).catch(() => {});
  }, []);
  return options;
}

/** The picker path (department, category, subcategory ids) leading to a saved target id */
export function pathTo(options: CascaderOption[], id: string, trail: string[] = []): string[] | null {
  for (const option of options) {
    const path = [...trail, option.value];
    if (option.value === id) return path;
    const found = option.children && pathTo(option.children, id, path);
    if (found) return found;
  }
  return null;
}

/**
 * The tap target for a CATEGORY banner. The picker holds the whole path so it can show names; on save
 * `withCategoryTarget` turns it into the deepest id, which is what the banner stores in actionTarget.
 */
export function CategoryTargetField({ options }: { options: CascaderOption[] }) {
  return (
    <Form.Item name="actionTargetPath" label="Target Category" rules={[{ required: true, message: "Pick where the banner leads" }]}>
      <Cascader
        options={options}
        changeOnSelect
        placeholder="Select a department, category, or subcategory"
        showSearch={{ filter: (input, path) => path.some((opt) => String(opt.label).toLowerCase().includes(input.toLowerCase())) }}
      />
    </Form.Item>
  );
}

export function withCategoryTarget(values: Record<string, unknown>) {
  const path = values.actionTargetPath as string[] | undefined;
  delete values.actionTargetPath;
  return values.actionType === "CATEGORY" && path?.length ? { ...values, actionTarget: path[path.length - 1] } : values;
}
