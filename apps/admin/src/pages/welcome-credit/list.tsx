import { useEffect, useState } from "react";
import { List, DateField, EditButton } from "@refinedev/antd";
import { Progress, Select, Space, Table, Tag, Typography, message } from "antd";
import { useGetIdentity } from "@refinedev/core";
import type { CreditCampaignRow } from "@martly/shared/types";
import { axiosInstance } from "../../providers/data-provider";
import { StoreSelect } from "../../components/StoreSelect";
import { inr } from "./format";

const PAGE_SIZE = 25;
const { Text } = Typography;

type Scope = "martly" | "store";

function useCampaigns(page: number, scope?: Scope, storeId?: string) {
  const [rows, setRows] = useState<CreditCampaignRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    axiosInstance
      .get("/credits/campaigns", { params: { page, pageSize: PAGE_SIZE, scope, storeId } })
      .then((res) => { setRows(res.data.data); setTotal(res.data.meta.total); })
      .catch((err) => message.error(err.response?.data?.message ?? "Couldn't load welcome credits"))
      .finally(() => setLoading(false));
  }, [page, scope, storeId]);

  return { rows, total, loading };
}

const Budget = ({ r }: { r: CreditCampaignRow }) => (
  <div style={{ minWidth: 140 }}>
    <Text>{inr(r.usage.committed)} of {inr(r.budget)}</Text>
    <Progress percent={Math.min(100, Math.round((r.usage.committed / r.budget) * 100))} size="small" showInfo={false} />
  </div>
);

export const WelcomeCreditList = () => {
  const { data: identity } = useGetIdentity<{ role: string }>();
  const [page, setPage] = useState(1);
  const [scope, setScope] = useState<Scope>();
  const [storeId, setStoreId] = useState<string>();
  const { rows, total, loading } = useCampaigns(page, scope, storeId);

  return (
    <List>
      <Space wrap style={{ marginBottom: 16 }}>
        {identity?.role === "SUPER_ADMIN" && (
          <Select allowClear placeholder="Funded by" style={{ width: 160 }} value={scope}
            onChange={(v) => { setScope(v); setPage(1); }}
            options={[{ label: "Martly", value: "martly" }, { label: "Stores", value: "store" }]} />
        )}
        <StoreSelect allowClear style={{ width: 240 }} value={storeId} onChange={(v) => { setStoreId(v); setPage(1); }} />
      </Space>
      <Table dataSource={rows} loading={loading} rowKey="id" size="small" scroll={{ x: "max-content" }}
        pagination={{ current: page, pageSize: PAGE_SIZE, total, showSizeChanger: false, onChange: setPage }}>
        <Table.Column title="Funded by" render={(_, r: CreditCampaignRow) =>
          r.storeId ? r.storeName : <Tag color="blue">Martly</Tag>} />
        <Table.Column dataIndex="amount" title="Credit" render={inr} />
        <Table.Column dataIndex="minOrderAmount" title="Min order" render={inr} />
        <Table.Column dataIndex="validDays" title="Valid days" />
        <Table.Column title="Budget used" render={(_, r: CreditCampaignRow) => <Budget r={r} />} />
        <Table.Column title="Outstanding" render={(_, r: CreditCampaignRow) => inr(r.usage.outstanding)} />
        <Table.Column title="Spent" render={(_, r: CreditCampaignRow) => inr(r.usage.spent)} />
        <Table.Column title="Reserved" render={(_, r: CreditCampaignRow) => inr(r.usage.reserved)} />
        <Table.Column title="Possible extra cost" render={(_, r: CreditCampaignRow) =>
          r.usage.possibleOverrun > 0 ? <Tag color="orange">{inr(r.usage.possibleOverrun)}</Tag> : "—"} />
        <Table.Column title="Given / used" render={(_, r: CreditCampaignRow) => `${r.usage.grantCount} / ${r.usage.usedCount}`} />
        <Table.Column title="Cost per new customer" render={(_, r: CreditCampaignRow) =>
          r.usage.usedCount > 0 ? inr(r.usage.spent / r.usage.usedCount) : "—"} />
        <Table.Column dataIndex="isActive" title="Status" render={(v: boolean) =>
          <Tag color={v ? "green" : "default"}>{v ? "Active" : "Inactive"}</Tag>} />
        <Table.Column title="Dates" render={(_, r: CreditCampaignRow) => (
          <>
            <DateField value={r.startsAt} format="DD MMM YYYY" />
            {" – "}
            {r.endsAt ? <DateField value={r.endsAt} format="DD MMM YYYY" /> : "no end"}
          </>
        )} />
        <Table.Column title="Actions" render={(_, r: CreditCampaignRow) => <EditButton size="small" recordItemId={r.id} hideText />} />
      </Table>
    </List>
  );
};
