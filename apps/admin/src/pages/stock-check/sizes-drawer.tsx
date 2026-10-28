import { useEffect, useState } from "react";
import { Avatar, Button, Checkbox, Drawer, List, Space, Typography } from "antd";
import { EditOutlined } from "@ant-design/icons";
import type { StockCheckBrand, StockCheckProduct } from "@martly/shared/types";
import { UNBRANDED } from "@martly/shared/schemas";
import { inr } from "../offers/describe";
import { useStockGet, type StockCheckActions } from "./api";
import { ProductEditor } from "./product-editor";
import type { BrandTab } from "./brands-table";

interface Props {
  storeId: string;
  departmentId: string;
  brand: StockCheckBrand | null;
  /** The brand tab it was opened from: only products with a size in that state */
  tab: BrandTab;
  version: number;
  actions: StockCheckActions;
  onClose: () => void;
}

type Checked = Record<string, boolean>;

/** Every size of a brand's products, ticked where the store carries it */
export const SizesDrawer = ({ storeId, departmentId, brand, tab, version, actions, onClose }: Props) => {
  const [reloads, setReloads] = useState(0);
  const params = brand ? { storeId, departmentId, brandId: brand.id, status: tab } : null;
  const { data, loading } = useStockGet<StockCheckProduct[]>("products", params, version + reloads);
  const [checked, setChecked] = useState<Checked>({});
  const [editing, setEditing] = useState<StockCheckProduct | null>(null);

  // Keeps the choices already made when the products reload after an edit
  useEffect(() => {
    setChecked((prev) => {
      const next: Checked = {};
      for (const p of data ?? []) for (const s of p.sizes) next[s.storeProductId] = prev[s.storeProductId] ?? s.carried ?? s.isActive;
      return next;
    });
  }, [data]);

  const save = async () => {
    if (await actions.saveSizes(Object.entries(checked).map(([id, carried]) => ({ id, carried })))) onClose();
  };

  const toggleProduct = (p: StockCheckProduct, on: boolean) =>
    setChecked((c) => ({ ...c, ...Object.fromEntries(p.sizes.map((s) => [s.storeProductId, on])) }));

  const setAll = (on: boolean) => setChecked((c) => Object.fromEntries(Object.keys(c).map((id) => [id, on])));
  const sizeIds = Object.keys(checked);
  const carried = sizeIds.filter((id) => checked[id]).length;

  const edited = (ids: string[]) => {
    setChecked((c) => ({ ...c, ...Object.fromEntries(ids.map((id) => [id, true])) }));
    setReloads((n) => n + 1);
    setEditing(null);
  };

  const renderProduct = (p: StockCheckProduct) => {
    const on = p.sizes.filter((s) => checked[s.storeProductId]).length;
    return (
      <List.Item>
        <List.Item.Meta
          avatar={<Space><Checkbox checked={on === p.sizes.length} indeterminate={on > 0 && on < p.sizes.length} onChange={(e) => toggleProduct(p, e.target.checked)} /><Avatar shape="square" size={48} src={p.imageUrl} /></Space>}
          title={<Space><Typography.Text strong>{p.name}</Typography.Text><Button size="small" type="text" icon={<EditOutlined />} aria-label="Edit prices and sizes" onClick={() => setEditing(p)} /></Space>}
          description={
            <Space direction="vertical" size={2} style={{ opacity: on === 0 ? 0.5 : 1 }}>
              {p.sizes.map((s) => (
                <Checkbox key={s.storeProductId} checked={checked[s.storeProductId] ?? false} onChange={(e) => setChecked((c) => ({ ...c, [s.storeProductId]: e.target.checked }))}>
                  {s.variantName} · {inr(s.price)}
                </Checkbox>
              ))}
            </Space>
          }
        />
      </List.Item>
    );
  };

  return (
    <Drawer
      open={!!brand}
      onClose={onClose}
      width={520}
      title={brand?.id === UNBRANDED ? "Unbranded sizes" : `${brand?.name ?? ""} sizes`}
      extra={<Space><Button onClick={onClose}>Cancel</Button><Button type="primary" disabled={!data?.length} onClick={save}>Save</Button></Space>}
    >
      {sizeIds.length > 0 && (
        <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 8 }}>
          <Typography.Text type="secondary">{carried} of {sizeIds.length} sizes carried</Typography.Text>
          <Space size={0}>
            <Button type="link" onClick={() => setAll(true)}>All on</Button>
            <Button type="link" onClick={() => setAll(false)}>All off</Button>
          </Space>
        </Space>
      )}
      <List<StockCheckProduct> loading={loading} dataSource={data ?? []} renderItem={renderProduct} />
      <ProductEditor storeId={storeId} product={editing} onClose={() => setEditing(null)} onSaved={edited} />
    </Drawer>
  );
};
