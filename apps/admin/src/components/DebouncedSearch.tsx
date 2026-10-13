import { useEffect, useRef } from "react";
import { Input } from "antd";
import type { SearchProps } from "antd/es/input";

type DebouncedSearchProps = Omit<SearchProps, "onSearch"> & {
  onSearch: (value: string) => void;
  delay?: number;
};

export const DebouncedSearch = ({ onSearch, onChange, delay = 300, ...rest }: DebouncedSearchProps) => {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <Input.Search
      allowClear
      {...rest}
      onChange={(e) => {
        onChange?.(e);
        clearTimeout(timerRef.current);
        const value = e.target.value;
        timerRef.current = setTimeout(() => onSearch(value), value === "" ? 0 : delay);
      }}
      onSearch={(value) => {
        clearTimeout(timerRef.current);
        onSearch(value);
      }}
    />
  );
};
