import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, InputNumber, Table, Typography, App } from "antd";
import { TagOutlined } from "@ant-design/icons";
import type { CatalogRules } from "@martly/shared/schemas";
import type { UnpricedItem } from "@martly/shared/types";

import { sectionTitle } from "../../../theme";
import { errorMessage, onboardingApi } from "../../../pages/onboarding/api";

const { Text } = Typography;

interface Props {
  storeId: string;
  rules: CatalogRules;
  openingStock: number;
  /** Bumped after each apply, so the list reloads */
  version: number;
  onListed: () => void;
}

/** Loose produce and staples have no MRP: the owner's prices go in here and list them */
export function UnpricedTable({ storeId, rules, openingStock, version, onListed }: Props) {
  const { message } = App.useApp();
  const [items, setItems] = useState<UnpricedItem[]>();
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    onboardingApi.unpriced(storeId, rules).then(setItems).catch((err) => message.error(errorMessage(err, "Couldn't load unpriced items")));
  }, [storeId, rules, version]);

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (items ?? []).filter((i) => !q || `${i.productName} ${i.aisle}`.toLowerCase().includes(q));
  }, [items, filter]);
  const priced = Object.entries(prices).filter(([, p]) => p > 0);

  const save = async () => {
    setSaving(true);
    try {
      const r = await onboardingApi.listPriced(storeId, priced.map(([variantId, price]) => ({ variantId, price, stock: openingStock })));
      message.success(`${r.created} listed`);
      setPrices({});
      setItems((prev) => prev?.filter((i) => !(i.variantId in prices)));
      onListed();
    } catch (err) {
      message.error(errorMessage(err, "Couldn't list them"));
    } finally {
      setSaving(false);
    }
  };

  if (items && items.length === 0) return null;

  return (
    <Card
      size="small"
      title={sectionTitle(<TagOutlined />, `Needs a price${items ? ` (${items.length})` : ""}`)}
      extra={<Button type="primary" disabled={priced.length === 0} loading={saving} onClick={save}>List {priced.length || ""} priced</Button>}
    >
      <Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
        Fresh produce and loose staples have no printed MRP. Enter today's price for what the shop sells; leave the rest blank.
      </Text>
      <Input allowClear placeholder="Filter by product or aisle" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ maxWidth: 320, marginBottom: 8 }} />
      <Table<UnpricedItem> rowKey="variantId" size="small" loading={!items} dataSource={shown} pagination={{ pageSize: 15 }}>
        <Table.Column<UnpricedItem> title="Aisle" dataIndex="aisle" />
        <Table.Column<UnpricedItem> title="Product" dataIndex="productName" />
        <Table.Column<UnpricedItem> title="Size" dataIndex="variantName" />
        <Table.Column<UnpricedItem> title="Price" width={160} render={(_, i) => (
          <InputNumber min={1} addonBefore={"₹"} value={prices[i.variantId]} style={{ width: "100%" }}
            onChange={(v) => setPrices((p) => ({ ...p, [i.variantId]: v ?? 0 }))} />
        )} />
      </Table>
    </Card>
  );
}
