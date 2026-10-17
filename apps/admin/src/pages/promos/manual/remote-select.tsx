import { useEffect, useState } from "react";
import { Select } from "antd";
import { axiosInstance } from "../../../providers/data-provider";

interface Option { value: string; label: string }

const SEARCH_DEBOUNCE_MS = 300;

/** Searchable picker over an API list endpoint (`?q=`) whose rows carry `id` and `name` */
export function RemoteSelect({ path, value, onChange, placeholder }: { path: string; value?: string; onChange?: (id: string) => void; placeholder: string }) {
  const [options, setOptions] = useState<Option[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      axiosInstance
        .get(path, { params: { q: query || undefined, pageSize: 20 } })
        .then((res) => setOptions((res.data.data as { id: string; name: string }[]).map((r) => ({ value: r.id, label: r.name }))))
        .finally(() => setLoading(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [path, query]);

  return <Select showSearch filterOption={false} loading={loading} options={options} value={value} onChange={onChange} onSearch={setQuery} placeholder={placeholder} />;
}
