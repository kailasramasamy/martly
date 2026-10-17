import { Button, Card, Image, Space, Table, Typography } from "antd";
import { DeleteOutlined, ShoppingOutlined } from "@ant-design/icons";
import type { PromoDetail, PromoProduct } from "@martly/shared/types";
import { sectionTitle } from "../../theme";
import { formatRange } from "./promo-utils";

const { Text } = Typography;

function PriceCell({ p }: { p: PromoProduct }) {
  if (p.promoPriceMin == null || p.promoPriceMax == null) return <>{formatRange(p.priceMin, p.priceMax)}</>;
  return (
    <Space size={6}>
      <Text delete type="secondary">{formatRange(p.priceMin, p.priceMax)}</Text>
      <Text strong>{formatRange(p.promoPriceMin, p.promoPriceMax)}</Text>
    </Space>
  );
}

function priceChangeSummary(changes: NonNullable<PromoDetail["priceChanges"]>): string {
  const base = `${changes.listings} listings across ${changes.stores} stores`;
  return changes.keptExisting > 0 ? `${base}; ${changes.keptExisting} kept a bigger existing discount` : base;
}

export function PromoProducts({ promo, busy, onRemove }: { promo: PromoDetail; busy: boolean; onRemove: (productId: string) => void }) {
  const removable = promo.status === "READY" && promo.kind === "AI";
  return (
    <Card title={sectionTitle(<ShoppingOutlined />, promo.productCount > promo.products.length ? `Products (first ${promo.products.length} of ${promo.productCount})` : `Products (${promo.productCount})`)} size="small">
      {promo.priceChanges && <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>{priceChangeSummary(promo.priceChanges)}</Text>}
      <Table<PromoProduct> dataSource={promo.products} rowKey="productId" pagination={false} size="small">
        <Table.Column<PromoProduct> title="" dataIndex="imageUrl" width={56} render={(url) => (url ? <Image src={url} width={40} preview={false} /> : null)} />
        <Table.Column<PromoProduct> title="Name" dataIndex="name" />
        <Table.Column<PromoProduct> title="Brand" dataIndex="brand" render={(v) => v ?? "—"} />
        <Table.Column<PromoProduct> title="Subcategory" dataIndex="subcategory" render={(v) => v ?? "—"} />
        <Table.Column<PromoProduct> title="Price" render={(_, p) => <PriceCell p={p} />} />
        {removable && (
          <Table.Column<PromoProduct>
            title=""
            width={56}
            render={(_, p) => <Button danger type="text" icon={<DeleteOutlined />} disabled={busy} onClick={() => onRemove(p.productId)} aria-label={`Remove ${p.name}`} />}
          />
        )}
      </Table>
    </Card>
  );
}
