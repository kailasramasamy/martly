import { List, useTable } from "@refinedev/antd";
import { useNavigation } from "@refinedev/core";
import { Image, Space, Table, Tag, Typography } from "antd";
import dayjs from "dayjs";
import type { PromoSummary } from "@martly/shared/types";
import { PROMO_STATUS_CONFIG } from "../../constants/tag-colors";
import { PromoCreateCard } from "./create-card";
import { discountLabel } from "./promo-utils";

const { Text } = Typography;
const THUMB_WIDTH = 96;

const formatDay = (iso: string | null) => (iso ? dayjs(iso).format("D MMM") : "—");

function PromoThumb({ url }: { url: string | null }) {
  if (!url) return <div style={{ width: THUMB_WIDTH, aspectRatio: "3 / 2", background: "#f1f5f9", borderRadius: 6 }} />;
  return <Image src={url} width={THUMB_WIDTH} preview={false} style={{ aspectRatio: "3 / 2", objectFit: "cover", borderRadius: 6 }} />;
}

export const PromoList = () => {
  const { tableProps } = useTable<PromoSummary>({ resource: "promos", pagination: { pageSize: 25 } });
  const { show } = useNavigation();

  return (
    <List title="Promos" breadcrumb={false}>
      <PromoCreateCard />
      <Table<PromoSummary>
        {...tableProps}
        rowKey="id"
        onRow={(record) => ({ onClick: () => show("promos", record.id), style: { cursor: "pointer" } })}
      >
        <Table.Column<PromoSummary> title="Banner" dataIndex="imageUrl" width={THUMB_WIDTH + 32} render={(url) => <PromoThumb url={url} />} />
        <Table.Column<PromoSummary>
          title="Promo"
          render={(_, r) =>
            r.title ? (
              <Space direction="vertical" size={0}>
                <Text strong>{r.title}</Text>
                <Text type="secondary">{r.brief}</Text>
              </Space>
            ) : (
              <Text type="secondary">{r.brief}</Text>
            )
          }
        />
        <Table.Column<PromoSummary>
          title="Status"
          dataIndex="status"
          render={(status: string) => <Tag color={PROMO_STATUS_CONFIG[status]?.color}>{PROMO_STATUS_CONFIG[status]?.label ?? status}</Tag>}
        />
        <Table.Column<PromoSummary> title="Discount" render={(_, r) => discountLabel(r.discountType, r.discountValue)} />
        <Table.Column<PromoSummary> title="Products" dataIndex="productCount" />
        <Table.Column<PromoSummary> title="Window" render={(_, r) => `${formatDay(r.startsAt)} – ${formatDay(r.endsAt)}`} />
        <Table.Column<PromoSummary> title="Created" dataIndex="createdAt" render={(v: string) => dayjs(v).format("D MMM, h:mm A")} />
      </Table>
    </List>
  );
};
