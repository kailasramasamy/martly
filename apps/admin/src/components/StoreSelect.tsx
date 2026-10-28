import { useEffect, useState } from "react";
import { Select } from "antd";
import type { SelectProps } from "antd";

import { axiosInstance } from "../providers/data-provider";

/** With only one store there is nothing to choose, so it is picked; pages that need a store before they show anything use this */
export function usePickLoneStore(storeIds: string[], value: string | null | undefined, pick: (id: string) => void) {
  const lone = storeIds.length === 1 ? storeIds[0] : undefined;
  useEffect(() => {
    if (lone && value == null) pick(lone);
  }, [lone, value, pick]);
}

/** The member's stores, the only one picked for them */
export const StoreSelect = (props: SelectProps) => {
  const [options, setOptions] = useState<{ label: string; value: string }[]>([]);
  const { value, onChange } = props;

  useEffect(() => {
    axiosInstance
      .get("/stores", { params: { pageSize: 100 } })
      .then((res) =>
        setOptions(res.data.data.map((s: { id: string; name: string }) => ({ label: s.name, value: s.id }))),
      )
      .catch(() => setOptions([]));
  }, []);

  usePickLoneStore(options.map((o) => o.value), value, (id) => onChange?.(id, options[0]));

  return <Select showSearch optionFilterProp="label" placeholder="Select store" options={options} {...props} />;
};
