import { useEffect, useMemo, useState } from "react";
import { Select } from "antd";
import type { SelectProps } from "antd";
import type { Town } from "@martly/shared/types";

import { axiosInstance } from "../providers/data-provider";

export const townLabel = (t: Town) => `${t.name} — ${t.district}, ${t.state}`;

interface TownSelectProps extends Omit<SelectProps, "options" | "onChange"> {
  /** The town already saved on the record, so an existing value shows its label before any search */
  initialTown?: Town | null;
  onChange?: (townId: string, town: Town) => void;
}

/** Searchable town picker; searches the server as you type */
export const TownSelect = ({ initialTown, onChange, ...props }: TownSelectProps) => {
  const [towns, setTowns] = useState<Town[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      axiosInstance
        .get("/towns", { params: { q: query || undefined, pageSize: 50 } })
        .then((res) => setTowns(res.data.data))
        .catch(() => setTowns([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const options = useMemo(() => {
    const all = initialTown && !towns.some((t) => t.id === initialTown.id) ? [initialTown, ...towns] : towns;
    return all.map((t) => ({ value: t.id, label: townLabel(t), town: t }));
  }, [towns, initialTown]);

  return (
    <Select
      showSearch
      filterOption={false}
      onSearch={setQuery}
      placeholder="Search for a town"
      options={options}
      onChange={(value, option) => onChange?.(value as string, (option as { town: Town }).town)}
      {...props}
    />
  );
};
