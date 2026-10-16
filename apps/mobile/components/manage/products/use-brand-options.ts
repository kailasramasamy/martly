import { useMemo } from "react";
import { useResource } from "../../../lib/manage/use-resource";
import type { SelectOption } from "../ui/OptionSheet";

interface BrandRow {
  id: string;
  name: string;
}

/** All brands as select options, led by a "No brand" choice */
export function useBrandOptions(): SelectOption[] {
  const { data } = useResource<BrandRow[]>("/api/v1/brands?pageSize=1000");
  return useMemo(
    () => [{ value: "", label: "No brand" }, ...(data ?? []).map((b) => ({ value: b.id, label: b.name }))],
    [data],
  );
}
