import { useEffect, useState } from "react";
import { Avatar, Select, Space, Typography } from "antd";
import { axiosInstance } from "../../providers/data-provider";

const PAGE_SIZE = 20;

export interface SponsorableProduct {
  id: string;
  name: string;
  imageUrl: string | null;
  subcategory: { name: string; category: { id: string; name: string } } | null;
}

interface ProductPickerProps {
  value?: string;
  onChange?: (id: string) => void;
  /** Called with the product the brand chose, so the form can follow its category and title */
  onPick: (product: SponsorableProduct) => void;
  brandId?: string;
  disabled?: boolean;
}

/** The chosen product with its photo and the category it will advertise in */
function ChosenProduct({ product }: { product: SponsorableProduct }) {
  return (
    <Space style={{ marginTop: 12 }} align="center">
      <Avatar shape="square" size={72} src={product.imageUrl ?? undefined}>{product.name[0]}</Avatar>
      <Space direction="vertical" size={0}>
        <Typography.Text strong>{product.name}</Typography.Text>
        <Typography.Text type="secondary">Shows in: {product.subcategory?.category.name ?? "No category"}</Typography.Text>
      </Space>
    </Space>
  );
}

export function ProductPicker({ value, onChange, onPick, brandId, disabled }: ProductPickerProps) {
  const [options, setOptions] = useState<SponsorableProduct[]>([]);
  const [chosen, setChosen] = useState<SponsorableProduct | null>(null);

  const search = async (q: string) => {
    if (!brandId) return setOptions([]);
    const res = await axiosInstance.get("/products", { params: { brandId, q: q || undefined, pageSize: PAGE_SIZE } });
    setOptions(res.data.data);
  };

  useEffect(() => { void search(""); }, [brandId]);

  useEffect(() => {
    if (!value || chosen?.id === value) return;
    axiosInstance.get(`/products/${value}`).then((res) => setChosen(res.data.data));
  }, [value, chosen?.id]);

  const pick = (id: string) => {
    const product = options.find((p) => p.id === id);
    if (!product) return;
    setChosen(product);
    onChange?.(id);
    onPick(product);
  };

  const shown = chosen && !options.some((p) => p.id === chosen.id) ? [chosen, ...options] : options;
  return (
    <>
      <Select
        showSearch
        filterOption={false}
        disabled={disabled || !brandId}
        placeholder={brandId ? "Search the brand's products" : "Choose a brand first"}
        value={value}
        onChange={pick}
        onSearch={(q) => void search(q)}
        options={shown.map((p) => ({ value: p.id, label: p.name }))}
      />
      {value && chosen && <ChosenProduct product={chosen} />}
    </>
  );
}
