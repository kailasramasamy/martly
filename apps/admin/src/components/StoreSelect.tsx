import { useEffect, useState } from "react";
import { Select } from "antd";
import type { SelectProps } from "antd";

import { axiosInstance } from "../providers/data-provider";

export const StoreSelect = (props: SelectProps) => {
  const [options, setOptions] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    axiosInstance
      .get("/stores", { params: { pageSize: 100 } })
      .then((res) =>
        setOptions(res.data.data.map((s: { id: string; name: string }) => ({ label: s.name, value: s.id }))),
      )
      .catch(() => setOptions([]));
  }, []);

  return <Select showSearch optionFilterProp="label" placeholder="Select store" options={options} {...props} />;
};
