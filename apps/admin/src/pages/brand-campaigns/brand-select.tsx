import { useEffect, useState } from "react";
import { Select } from "antd";
import { axiosInstance } from "../../providers/data-provider";
import type { BrandRef } from "./types";

const PAGE_SIZE = 20;

interface BrandSelectProps {
  value?: string;
  onChange?: (id: string | undefined) => void;
  /** The currently chosen brand, so its name shows before any search */
  selected?: BrandRef;
  allowClear?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function BrandSelect({ value, onChange, selected, allowClear, disabled, placeholder = "Search brands" }: BrandSelectProps) {
  const [options, setOptions] = useState<BrandRef[]>([]);

  const search = async (q: string) => {
    const res = await axiosInstance.get("/brands", { params: { q, pageSize: PAGE_SIZE } });
    setOptions(res.data.data);
  };

  useEffect(() => { void search(""); }, []);

  const all = selected && !options.some((b) => b.id === selected.id) ? [selected, ...options] : options;
  return (
    <Select
      showSearch
      filterOption={false}
      allowClear={allowClear}
      disabled={disabled}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      onSearch={(q) => void search(q)}
      options={all.map((b) => ({ value: b.id, label: b.name }))}
      style={{ minWidth: 220 }}
    />
  );
}
