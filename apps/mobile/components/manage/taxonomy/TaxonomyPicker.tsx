import { useMemo } from "react";
import { SelectField, type SelectOption } from "../ui/SelectField";
import type { DepartmentNode, TaxonomySelection } from "./types";

const ANY = "__any__";

interface TaxonomyPickerProps {
  tree: DepartmentNode[];
  value: TaxonomySelection;
  onChange: (next: TaxonomySelection) => void;
  /** Adds "All …" options so each level can be left open (list filters) */
  allowAny?: boolean;
  required?: boolean;
  error?: string | null;
  disabled?: boolean;
}

function withAny(options: SelectOption[], label: string, allowAny?: boolean): SelectOption[] {
  return allowAny ? [{ value: ANY, label }, ...options] : options;
}

/** Department → category → subcategory as chained SelectFields; each level resets the ones below it */
export function TaxonomyPicker({ tree, value, onChange, allowAny, required, error, disabled }: TaxonomyPickerProps) {
  const dept = tree.find((d) => d.id === value.departmentId);
  const cat = dept?.categories.find((c) => c.id === value.categoryId);

  const deptOptions = useMemo(
    () => withAny(tree.map((d) => ({ value: d.id, label: d.name })), "All departments", allowAny),
    [tree, allowAny],
  );
  const catOptions = useMemo(
    () => withAny((dept?.categories ?? []).map((c) => ({ value: c.id, label: c.name })), "All categories", allowAny),
    [dept, allowAny],
  );
  const subOptions = useMemo(
    () => withAny((cat?.subcategories ?? []).map((s) => ({ value: s.id, label: s.name })), "All subcategories", allowAny),
    [cat, allowAny],
  );
  const pick = (level: keyof TaxonomySelection, id: string) => {
    const next = id === ANY ? "" : id;
    if (level === "departmentId") onChange({ departmentId: next, categoryId: "", subcategoryId: "" });
    else if (level === "categoryId") onChange({ ...value, categoryId: next, subcategoryId: "" });
    else onChange({ ...value, subcategoryId: next });
  };
  const current = (id: string) => id || (allowAny ? ANY : null);

  return (
    <>
      <SelectField label="Department" required={required} value={current(value.departmentId)} options={deptOptions} disabled={disabled}
        onChange={(id) => pick("departmentId", id)} placeholder="Choose department" error={error && !value.departmentId ? error : null} />
      <SelectField label="Category" required={required} value={current(value.categoryId)} options={catOptions} disabled={disabled || !dept}
        onChange={(id) => pick("categoryId", id)} placeholder={dept ? "Choose category" : "Pick a department first"} />
      <SelectField label="Subcategory" required={required} value={current(value.subcategoryId)} options={subOptions} disabled={disabled || !cat}
        onChange={(id) => pick("subcategoryId", id)} placeholder={cat ? "Choose subcategory" : "Pick a category first"} />
    </>
  );
}
