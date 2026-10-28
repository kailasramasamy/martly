import { useState } from "react";
import { App, Button, InputNumber, Modal, Select, Space, Typography } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { isAxiosError } from "axios";
import type { ApiResponse, StockCheckEditResult, StockCheckProduct } from "@martly/shared/types";
import { UNIT_SHORT_LABELS, UnitType, variantName } from "@martly/shared/constants";
import { axiosInstance } from "../../providers/data-provider";

interface NewSize {
  key: number;
  unitType: UnitType;
  unitValue: number | null;
  price: number | null;
}

interface Props {
  storeId: string;
  product: StockCheckProduct | null;
  onClose: () => void;
  onSaved: (storeProductIds: string[]) => void;
}

const UNIT_OPTIONS = Object.values(UnitType).map((u) => ({ value: u, label: UNIT_SHORT_LABELS[u] }));
let nextKey = 0;

/** Fix a product's prices and add the sizes the store sells that the catalog lacks */
export const ProductEditor = ({ storeId, product, onClose, onSaved }: Props) => {
  const { message } = App.useApp();
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [newSizes, setNewSizes] = useState<NewSize[]>([]);
  const [saving, setSaving] = useState(false);

  const priceOf = (id: string, original: number) => (id in prices ? prices[id] : original);
  const patchNew = (key: number, change: Partial<NewSize>) => setNewSizes((rows) => rows.map((r) => (r.key === key ? { ...r, ...change } : r)));
  const addRow = () => setNewSizes((rows) => [...rows, { key: nextKey++, unitType: UnitType.KG, unitValue: null, price: null }]);

  const save = async () => {
    if (!product) return;
    const changed = product.sizes.filter((s) => priceOf(s.storeProductId, s.price) !== s.price);
    if (changed.some((s) => !priceOf(s.storeProductId, s.price))) return void message.error("Every price needs to be above ₹0");
    if (newSizes.some((n) => !n.unitValue || !n.price)) return void message.error("Each new size needs a quantity and a price above 0");
    if (changed.length + newSizes.length === 0) return void message.info("Nothing changed");
    setSaving(true);
    try {
      const { data } = await axiosInstance.post<ApiResponse<StockCheckEditResult>>("/stock-check/edit", {
        storeId,
        productId: product.id,
        sizes: changed.map((s) => ({ id: s.storeProductId, price: prices[s.storeProductId] })),
        newSizes: newSizes.map((n) => ({ unitType: n.unitType, unitValue: n.unitValue, price: n.price })),
      });
      message.success("Saved");
      onSaved(data.data.storeProductIds);
    } catch (err) {
      if (!isAxiosError(err)) throw err;
      message.error(err.response?.data?.message ?? "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!product} title={product?.name} onCancel={onClose} onOk={save} okText="Save" confirmLoading={saving} destroyOnClose afterClose={() => { setPrices({}); setNewSizes([]); }}>
      <Space direction="vertical" style={{ width: "100%" }}>
        {product?.sizes.map((s) => (
          <Space key={s.storeProductId}>
            <Typography.Text style={{ display: "inline-block", width: 120 }}>{s.variantName}</Typography.Text>
            <InputNumber min={0} prefix={"₹"} value={priceOf(s.storeProductId, s.price)} onChange={(v) => setPrices((p) => ({ ...p, [s.storeProductId]: v }))} style={{ width: 120 }} />
          </Space>
        ))}
        <Typography.Text strong>Add a size</Typography.Text>
        {newSizes.map((n) => (
          <Space key={n.key} wrap>
            <InputNumber min={0} placeholder="Qty" value={n.unitValue} onChange={(v) => patchNew(n.key, { unitValue: v })} style={{ width: 80 }} />
            <Select value={n.unitType} options={UNIT_OPTIONS} onChange={(unitType) => patchNew(n.key, { unitType })} style={{ width: 90 }} />
            <InputNumber min={0} prefix={"₹"} placeholder="Price" value={n.price} onChange={(v) => patchNew(n.key, { price: v })} style={{ width: 110 }} />
            {n.unitValue ? <Typography.Text type="secondary">{variantName(n.unitType, n.unitValue)}</Typography.Text> : null}
            <Button type="text" danger icon={<DeleteOutlined />} aria-label="Remove size" onClick={() => setNewSizes((rows) => rows.filter((r) => r.key !== n.key))} />
          </Space>
        ))}
        <Button icon={<PlusOutlined />} onClick={addRow}>Add a size</Button>
      </Space>
    </Modal>
  );
};
