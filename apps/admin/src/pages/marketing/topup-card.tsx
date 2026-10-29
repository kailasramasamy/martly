import { useState } from "react";
import { Button, Card, InputNumber, Space, Tooltip, Typography } from "antd";
import { formatRupees } from "../promos/promo-utils";
import type { AdProduct } from "./types";

const { Text } = Typography;
const MAX_TOPUP = 12;
const OWNER_ONLY = "Only the owner can buy";

interface TopupCardProps {
  title: string;
  product: AdProduct;
  /** Where the allowance stands, above the price */
  status?: string;
  description?: string;
  buyLabel: (quantity: number) => string;
  canBuy: boolean;
  buying: string | null;
  buy: (p: AdProduct, quantity: number) => void;
}

export function TopupCard({ title, product, status, description, buyLabel, canBuy, buying, buy }: TopupCardProps) {
  const [quantity, setQuantity] = useState(1);
  return (
    <Card size="small" title={title} style={{ height: "100%" }}>
      {status && <div><Text strong>{status}</Text></div>}
      {description && <div style={{ marginBottom: 8 }}><Text type="secondary">{description}</Text></div>}
      <Space wrap>
        <Text>{formatRupees(product.price)} each +{product.gstPercent}% GST</Text>
        <InputNumber min={1} max={MAX_TOPUP} precision={0} value={quantity} onChange={(v) => setQuantity(v ?? 1)} />
        <Tooltip title={canBuy ? undefined : OWNER_ONLY}>
          <Button type="primary" disabled={!canBuy} loading={buying === product.id} onClick={() => buy(product, quantity)}>
            {buyLabel(quantity)}
          </Button>
        </Tooltip>
      </Space>
    </Card>
  );
}
