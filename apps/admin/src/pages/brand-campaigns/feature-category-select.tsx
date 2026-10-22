import { useEffect, useState } from "react";
import { Select } from "antd";
import { axiosInstance } from "../../providers/data-provider";

interface BrandCategory { id: string; name: string; department: string; products: number }

interface FeatureCategorySelectProps {
  apiBase: string;
  brandId?: string;
  value?: string;
  onChange?: (id: string | undefined) => void;
  disabled?: boolean;
}

/** The categories a brand sells in, most products first; the top one is picked until someone chooses another */
export function FeatureCategorySelect({ apiBase, brandId, value, onChange, disabled }: FeatureCategorySelectProps) {
  const [categories, setCategories] = useState<BrandCategory[] | null>(null);

  useEffect(() => {
    setCategories(null);
    if (!brandId) return;
    axiosInstance.get(`${apiBase}/brand-categories`, { params: { brandId } }).then((res) => setCategories(res.data.data));
  }, [apiBase, brandId]);

  useEffect(() => {
    if (disabled || !categories?.length || categories.some((c) => c.id === value)) return;
    onChange?.(categories[0].id);
  }, [categories, value, disabled, onChange]);

  return (
    <Select
      value={value}
      onChange={onChange}
      disabled={disabled || !brandId}
      loading={!!brandId && categories === null}
      showSearch
      optionFilterProp="label"
      placeholder={brandId ? "Search the brand's categories" : "Choose a brand first"}
      notFoundContent={categories?.length === 0 ? "This brand has no products yet" : undefined}
      options={(categories ?? []).map((c) => ({
        value: c.id,
        label: `${c.name} · ${c.department} · ${c.products} product${c.products === 1 ? "" : "s"}`,
      }))}
    />
  );
}
