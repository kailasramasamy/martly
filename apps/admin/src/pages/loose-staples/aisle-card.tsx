import { memo } from "react";
import { Button, Card, Image, Input, Space, Table, Typography } from "antd";
import type { LooseStapleAisle, LooseStapleItem } from "@martly/shared/types";
import { draftChange, type Drafts } from "./drafts";

const RUPEE = "₹";
const money = (n: number) => `${RUPEE}${n.toLocaleString("en-IN")}`;

interface AisleCardProps {
  aisle: LooseStapleAisle;
  /** Every size in the aisle, for the "on sale" tally whatever the tab shows */
  total: { listed: number; sizes: number };
  drafts: Drafts;
  onPrice: (variantId: string, text: string) => void;
  onFill: (items: LooseStapleItem[]) => void;
}

// What the store does with this size now, or what a fair starting price would be
function noteOf(item: LooseStapleItem) {
  if (item.listed?.isActive) return <Typography.Text type="success">Selling at {money(item.listed.price)} · {item.listed.stock} in stock</Typography.Text>;
  if (item.listed) return <Typography.Text type="secondary">Turned off · was {money(item.listed.price)}</Typography.Text>;
  if (item.suggested !== null) return <Typography.Text type="secondary">Suggested {money(item.suggested)}</Typography.Text>;
  return <Typography.Text type="secondary">Set your price</Typography.Text>;
}

/** One staple aisle: its sizes with a price box each, and a click to start from the suggested prices */
export const AisleCard = memo(function AisleCard({ aisle, total, drafts, onPrice, onFill }: AisleCardProps) {
  const fillable = aisle.items.some((i) => !i.listed && i.suggested !== null && drafts[i.variantId] === undefined);
  return (
    <Card
      size="small"
      style={{ marginBottom: 16 }}
      title={
        <Space direction="vertical" size={0}>
          <Typography.Text type="secondary" style={{ fontSize: 11, letterSpacing: 1 }}>{aisle.category.toUpperCase()}</Typography.Text>
          <Typography.Text strong>{aisle.name}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>{total.listed} of {total.sizes} sizes on sale</Typography.Text>
        </Space>
      }
      extra={fillable && <Button onClick={() => onFill(aisle.items)}>Use suggested</Button>}
    >
      <Table<LooseStapleItem>
        size="small"
        rowKey="variantId"
        pagination={false}
        showHeader={false}
        dataSource={aisle.items}
        columns={[
          { key: "photo", width: 56, render: (_, i) => <Image src={i.imageUrl ?? undefined} width={40} height={40} style={{ objectFit: "contain" }} preview={false} fallback="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" /> },
          { key: "name", render: (_, i) => <Typography.Text strong>{i.name}</Typography.Text> },
          { key: "size", dataIndex: "size", width: 120 },
          { key: "note", render: (_, i) => noteOf(i) },
          {
            key: "price",
            width: 140,
            render: (_, i) => (
              <Input
                prefix={RUPEE}
                inputMode="decimal"
                maxLength={7}
                value={drafts[i.variantId] ?? ""}
                status={draftChange(i, drafts) !== null ? "warning" : undefined}
                placeholder={String(i.listed?.price ?? i.suggested ?? "")}
                onChange={(e) => onPrice(i.variantId, e.target.value)}
                aria-label={`Price for ${i.name} ${i.size}`}
              />
            ),
          },
        ]}
      />
    </Card>
  );
});
