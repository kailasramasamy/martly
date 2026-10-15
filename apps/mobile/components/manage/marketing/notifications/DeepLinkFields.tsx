import { SelectField } from "../../ui/SelectField";
import { useManageScope } from "../../../../lib/manage-scope-context";
import { RemotePicker } from "../RemotePicker";
import { useTaxonomyOptions } from "../taxonomy";
import type { Compose } from "./compose";

const TYPE_OPTIONS = [
  { value: "", label: "None" },
  { value: "product", label: "Product" },
  { value: "category", label: "Category" },
  { value: "store", label: "Store" },
  { value: "screen", label: "Screen" },
];

const SCREEN_OPTIONS = [
  { value: "home", label: "Home" },
  { value: "categories", label: "Categories" },
  { value: "orders", label: "Orders" },
  { value: "wallet", label: "Wallet" },
  { value: "loyalty", label: "Loyalty points" },
  { value: "wishlist", label: "Wishlist" },
  { value: "search", label: "Search" },
];

interface Props {
  value: Compose;
  onChange: (patch: Partial<Compose>) => void;
  error?: string;
}

export function DeepLinkFields({ value, onChange, error }: Props) {
  const { stores } = useManageScope();
  const taxonomy = useTaxonomyOptions();
  const pick = (deepLinkId: string) => onChange({ deepLinkId });
  const type = value.deepLinkType;
  const options = type === "category"
    ? taxonomy.options.map((o) => ({ value: o.id, label: o.label }))
    : type === "store" ? stores.map((s) => ({ value: s.id, label: s.name })) : SCREEN_OPTIONS;

  return (
    <>
      <SelectField label="Opens when tapped" value={type} options={TYPE_OPTIONS} onChange={(deepLinkType) => onChange({ deepLinkType, deepLinkId: null })} />
      {type === "product" ? <RemotePicker label="Target product" required path="/api/v1/products" value={value.deepLinkId} onChange={pick} error={error} /> : null}
      {type && type !== "product" ? <SelectField label={`Target ${type}`} required value={value.deepLinkId} options={options} onChange={pick} error={error} /> : null}
    </>
  );
}
