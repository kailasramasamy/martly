import { List, useTable } from "@refinedev/antd";
import { useNavigation } from "@refinedev/core";
import { useState } from "react";
import { App, Button, Image, Popconfirm, Space, Table, Tag, Typography } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { isAxiosError } from "axios";
import { axiosInstance } from "../../providers/data-provider";
import dayjs from "dayjs";
import type { PromoSummary } from "@martly/shared/types";
import { PROMO_STATUS_CONFIG } from "../../constants/tag-colors";
import { discountLabel, PromoKindTag } from "./promo-utils";

const { Text } = Typography;
const THUMB_WIDTH = 96;

const formatDay = (iso: string | null) => (iso ? dayjs(iso).format("D MMM") : "—");

function PromoThumb({ url }: { url: string | null }) {
  if (!url) return <div style={{ width: THUMB_WIDTH, aspectRatio: "3 / 2", background: "#f1f5f9", borderRadius: 6 }} />;
  return <Image src={url} width={THUMB_WIDTH} preview={false} style={{ aspectRatio: "3 / 2", objectFit: "cover", borderRadius: 6 }} />;
}

/** End a live promotion or delete one, without opening it; clicks stay off the row's open-on-click */
function RowActions({ promo, onDone }: { promo: PromoSummary; onDone: () => void }) {
  const { message } = App.useApp();
  const [busy, setBusy] = useState<"end" | "delete" | null>(null);
  const act = async (kind: "end" | "delete") => {
    setBusy(kind);
    try {
      if (kind === "end") await axiosInstance.post(`/promos/${promo.id}/end`);
      else await axiosInstance.delete(`/promos/${promo.id}`);
      message.success(kind === "end" ? "Promotion ended; prices restored" : "Promotion deleted");
      onDone();
    } catch (err) {
      message.error(isAxiosError(err) ? (err.response?.data?.message ?? "Something went wrong") : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };
  if (promo.status === "DRAFTING" || promo.fromBrand) return null;
  return (
    <Space onClick={(e) => e.stopPropagation()}>
      {promo.status === "LIVE" && (
        <Popconfirm title="End this promotion now?" description="Removes the banner and restores prices" okText="End now" okButtonProps={{ danger: true }} onConfirm={() => act("end")}>
          <Button size="small" loading={busy === "end"}>End</Button>
        </Popconfirm>
      )}
      <Popconfirm
        title="Delete this promotion?"
        description={promo.status === "LIVE" ? "It ends now (prices go back), then it is removed." : "Its banner and results are removed."}
        okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => act("delete")}
      >
        <Button size="small" danger icon={<DeleteOutlined />} loading={busy === "delete"} aria-label="Delete" />
      </Popconfirm>
    </Space>
  );
}

export const PromoList = () => {
  const { tableProps, tableQuery } = useTable<PromoSummary>({ resource: "promos", pagination: { pageSize: 25 } });
  const { show } = useNavigation();

  return (
    <List title="Promotions" breadcrumb={false}>
      <Table<PromoSummary>
        {...tableProps}
        rowKey="id"
        onRow={(record) => ({ onClick: () => show("promos", record.id), style: { cursor: "pointer" } })}
      >
        <Table.Column<PromoSummary> title="Banner" dataIndex="imageUrl" width={THUMB_WIDTH + 32} render={(url) => <PromoThumb url={url} />} />
        <Table.Column<PromoSummary>
          title="Promotion"
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
        <Table.Column<PromoSummary> title="Kind" dataIndex="kind" render={(kind: PromoSummary["kind"]) => <PromoKindTag kind={kind} />} />
        <Table.Column<PromoSummary>
          title="Status"
          dataIndex="status"
          render={(status: string) => <Tag color={PROMO_STATUS_CONFIG[status]?.color}>{PROMO_STATUS_CONFIG[status]?.label ?? status}</Tag>}
        />
        <Table.Column<PromoSummary> title="Discount" render={(_, r) => discountLabel(r.discountType, r.discountValue)} />
        <Table.Column<PromoSummary> title="Products" dataIndex="productCount" />
        <Table.Column<PromoSummary> title="Window" render={(_, r) => `${formatDay(r.startsAt)} – ${formatDay(r.endsAt)}`} />
        <Table.Column<PromoSummary> title="Created" dataIndex="createdAt" render={(v: string) => dayjs(v).format("D MMM, h:mm A")} />
        <Table.Column<PromoSummary> title="Actions" width={110} render={(_, r) => <RowActions promo={r} onDone={() => tableQuery.refetch()} />} />
      </Table>
    </List>
  );
};
