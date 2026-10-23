import { useResource } from "../../../../lib/manage/use-resource";
import type { SelectOption } from "../../ui/OptionSheet";
import type { BrandPackage, Region } from "../types";

interface DepartmentNode { name: string; categories: { id: string; name: string }[] }

const BASE = "/api/v1/brand-campaigns";

/** Packages on sale, every category ("Department › Category"), districts with stores, and the stores themselves */
export function useBookingOptions() {
  const packages = useResource<BrandPackage[]>(`${BASE}/packages`);
  const tree = useResource<DepartmentNode[]>("/api/v1/categories/tree");
  const regions = useResource<Region[]>(`${BASE}/regions`);
  const storeList = useResource<{ id: string; name: string }[]>("/api/v1/stores?pageSize=200");

  const categories: SelectOption[] = (tree.data ?? []).flatMap((d) => d.categories.map((c) => ({ value: c.id, label: `${d.name} › ${c.name}` })));
  const districts: SelectOption[] = (regions.data ?? []).flatMap((r) =>
    r.district ? [{ value: `${r.state}:${r.district}`, label: `${r.district}, ${r.state} · ${r.stores} stores` }] : []);
  return {
    packages: packages.data ?? [], categories, districts,
    stores: (storeList.data ?? []).map((st): SelectOption => ({ value: st.id, label: st.name })),
    loading: packages.loading, error: packages.error, reload: packages.reload,
  };
}
