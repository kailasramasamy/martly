import { Avatar, Button, Card, Empty, Space, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { CampaignStatusTag } from "../list";
import type { Campaign } from "../types";
import { DAY_KEY } from "./calendar-data";
import { campaignColor } from "./package-colors";

interface Props {
  dayKey: string;
  campaigns: Campaign[];
  onOpen: (c: Campaign) => void;
  onBook: (dayKey: string) => void;
}

const range = (c: Campaign) => `${dayjs(c.startsAt).format("D MMM HH:mm")} – ${dayjs(c.endsAt).format("D MMM HH:mm")}`;

export function DayPanel({ dayKey, campaigns, onOpen, onBook }: Props) {
  const day = dayjs(dayKey);
  const isPast = day.isBefore(dayjs().format(DAY_KEY));
  const count = `${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"}`;
  return (
    <Card
      size="small"
      title={`${day.format("ddd, D MMM")} · ${count}`}
      extra={!isPast && <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => onBook(dayKey)}>Book from {day.format("D MMM")}</Button>}
    >
      {campaigns.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nothing running. This day is free." />}
      {campaigns.map((c) => (
        <div
          key={c.id}
          onClick={() => onOpen(c)}
          style={{ display: "flex", gap: 10, padding: "8px 0", cursor: "pointer", borderLeft: `3px solid ${campaignColor(c)}`, paddingLeft: 10, marginBottom: 4 }}
        >
          <Avatar shape="square" src={c.brand.imageUrl}>{c.brand.name[0]}</Avatar>
          <Space direction="vertical" size={0} style={{ flex: 1, minWidth: 0 }}>
            <Typography.Text strong ellipsis>{c.title}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {c.brand.name} · {c.product.name}{c.category ? ` · ${c.category.name}` : ""}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{range(c)}</Typography.Text>
          </Space>
          <CampaignStatusTag status={c.status} />
        </div>
      ))}
    </Card>
  );
}
