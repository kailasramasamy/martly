import { Avatar, Space, Typography } from "antd";
import type { StockCheckCounts } from "@martly/shared/types";
import { count } from "./api";

/** A few product photos so a department or brand is recognisable at a glance */
export const Thumbs = ({ images }: { images: string[] }) => (
  <Avatar.Group max={{ count: 3 }}>
    {images.slice(0, 3).map((src) => <Avatar key={src} shape="square" size={36} src={src} />)}
  </Avatar.Group>
);

export const Counts = ({ c }: { c: StockCheckCounts }) => (
  <div>
    <Space size={8} wrap>
      <Typography.Text style={{ color: "#16a34a" }}>{count(c.carried)} carried</Typography.Text>
      <Typography.Text style={{ color: "#dc2626" }}>{count(c.notCarried)} not sold</Typography.Text>
      <Typography.Text style={{ color: "#d97706" }}>{count(c.unchecked)} to confirm</Typography.Text>
    </Space>
    {c.suggested > 0 && <div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{count(c.suggested)} hidden suggestions</Typography.Text></div>}
  </div>
);

export const confirmedPct = (c: StockCheckCounts) => (c.total ? Math.round(((c.total - c.unchecked) / c.total) * 100) : 100);
