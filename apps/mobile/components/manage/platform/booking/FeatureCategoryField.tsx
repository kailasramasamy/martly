import { useEffect } from "react";
import { SelectField } from "../../ui/SelectField";
import { useResource } from "../../../../lib/manage/use-resource";
import { toQuery } from "../../../../lib/manage/query";
import type { BrandCategory } from "../types";

interface Props {
  brandId: string | null;
  value: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
  error?: string;
}

/** The categories a brand sells in, most products first; the top one is picked until someone chooses another */
export function FeatureCategoryField({ brandId, value, onChange, disabled, error }: Props) {
  const { data } = useResource<BrandCategory[]>(brandId ? `/api/v1/brand-campaigns/brand-categories${toQuery({ brandId })}` : null);
  const categories = brandId ? data : null;

  useEffect(() => {
    if (disabled || !categories?.length || categories.some((c) => c.id === value)) return;
    onChange(categories[0].id);
  }, [categories, value, disabled, onChange]);

  const options = (categories ?? []).map((c) => ({
    value: c.id,
    label: `${c.name} · ${c.department} · ${c.products} product${c.products === 1 ? "" : "s"}`,
  }));
  const empty = categories?.length === 0;
  return (
    <SelectField
      label="Category to feature the brand in"
      required
      hint={empty ? "This brand has no products yet" : "Categories the brand sells in, most products first"}
      error={error}
      value={value}
      options={options}
      onChange={onChange}
      placeholder={brandId ? "Choose a category" : "Choose a brand first"}
      disabled={disabled || !brandId || empty}
    />
  );
}
