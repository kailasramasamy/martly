import { Avatar, Button, InputNumber, Popconfirm, Space, Tag, Typography, theme } from "antd";
import type { PriceReviewItem } from "@martly/shared/types";
import { inr } from "../offers/describe";
import { effectiveMrp, effectivePrice, isDirty, offPct, type RowEdit } from "./edits";

const { Text } = Typography;
const SUSPICIOUS_RATIO = 0.5;

export const isSuspicious = (price: number, mrp: number | null) => mrp !== null && price < mrp * SUSPICIOUS_RATIO;

const STATUS_TAGS = {
  KEPT: { color: "green", label: "Kept" },
  CHANGED: { color: "blue", label: "Changed" },
} as const;

export const StatusTag = ({ item }: { item: PriceReviewItem }) => {
  const { outcome } = item;
  if (item.carried === false) return <Tag color="red">Not sold</Tag>;
  if (!outcome) return <Tag>Pending</Tag>;
  const { color, label } = STATUS_TAGS[outcome];
  return <Tag color={color}>{label}</Tag>;
};

export const ProductCell = ({ item }: { item: PriceReviewItem }) => (
  <Space>
    <Avatar shape="square" size={40} src={item.imageUrl} />
    <div>
      <Text strong>{item.productName}</Text> <Text>{item.variantName}</Text>
      {item.unitsSold30d > 0 && <Tag color="gold" style={{ marginLeft: 8 }}>Sold {item.unitsSold30d} in 30d</Tag>}
      <div><Text type="secondary" style={{ fontSize: 12 }}>{[item.brandName, item.subcategoryName].filter(Boolean).join(" · ")}</Text></div>
    </div>
  </Space>
);

interface CellProps {
  item: PriceReviewItem;
  edit?: RowEdit;
  onChange: (change: RowEdit) => void;
}

export const MrpCell = ({ item, edit, onChange }: CellProps) => {
  const mrp = effectiveMrp(item, edit);
  return (
    <div>
      <InputNumber min={0} prefix={"₹"} value={mrp} onChange={(v) => onChange({ mrp: v })} style={{ width: 110 }} />
      {mrp !== item.masterMrp && (
        <div style={{ fontSize: 12 }}>
          {item.masterMrp !== null && <Text type="secondary" delete>{inr(item.masterMrp)}</Text>}{" "}
          <a onClick={() => onChange({ mrp: null })}>reset</a>
        </div>
      )}
    </div>
  );
};

interface PriceCellProps extends CellProps {
  inputRef: (el: { focus: () => void } | null) => void;
  onEnter: () => void;
  onEscape: () => void;
}

export const PriceCell = ({ item, edit, onChange, inputRef, onEnter, onEscape }: PriceCellProps) => (
  <InputNumber
    ref={inputRef}
    min={0}
    prefix={"₹"}
    value={effectivePrice(item, edit)}
    onChange={(v) => onChange({ price: v ?? undefined })}
    onFocus={(e) => e.target.select()}
    onPressEnter={onEnter}
    onKeyDown={(e) => e.key === "Escape" && onEscape()}
    style={{ width: 110 }}
  />
);

export const OffCell = ({ item, edit }: { item: PriceReviewItem; edit?: RowEdit }) => {
  const price = effectivePrice(item, edit);
  const mrp = effectiveMrp(item, edit);
  const pct = offPct(price, mrp);
  if (pct === null) return <Text type="secondary">-</Text>;
  if (mrp !== null && price > mrp) return <Tag color="red">Over MRP</Tag>;
  return isSuspicious(price, mrp) ? <Tag color="gold">{pct}% off</Tag> : <span>{pct}%</span>;
};

interface ActionsProps {
  item: PriceReviewItem;
  edit?: RowEdit;
  canHide: boolean;
  onSave: () => void;
  onHide: () => void;
  onReopen: () => void;
}

export const ActionsCell = ({ item, edit, canHide, onSave, onHide, onReopen }: ActionsProps) => {
  const { token } = theme.useToken();
  const dirty = isDirty(item, edit);
  return (
    <Space size={4}>
      <Button size="small" type={dirty ? "primary" : "default"} onClick={onSave}>{dirty ? "Save" : "OK"}</Button>
      {canHide && (
        <Popconfirm title="Not sold here? Customers won't see it." okText="Hide" okButtonProps={{ danger: true }} onConfirm={onHide}>
          <Button size="small" type="link" danger>Hide</Button>
        </Popconfirm>
      )}
      {(item.outcome || item.carried === false) && <Button size="small" type="link" style={{ color: token.colorPrimary }} onClick={onReopen}>Reopen</Button>}
    </Space>
  );
};
