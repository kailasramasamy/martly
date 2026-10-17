import { Table, Typography } from "antd";
import { formatRupees } from "../promos/promo-utils";
import type { Campaign, CampaignResultRow } from "./types";

const num = (v: number) => v.toLocaleString("en-IN");

const columns = [
  { title: "Store", dataIndex: "store" },
  { title: "Views", dataIndex: "views", align: "right" as const, render: num },
  { title: "Taps", dataIndex: "taps", align: "right" as const, render: num },
  { title: "CTR", dataIndex: "ctr", align: "right" as const, render: (v: number) => `${v}%` },
  { title: "Orders", dataIndex: "orders", align: "right" as const, render: num },
  { title: "Units", dataIndex: "units", align: "right" as const, render: num },
  { title: "Revenue", dataIndex: "revenue", align: "right" as const, render: formatRupees },
];

export function CampaignResults({ results }: { results: NonNullable<Campaign["results"]> }) {
  const { total } = results;
  return (
    <Table<CampaignResultRow>
      size="small"
      rowKey="storeId"
      dataSource={results.stores}
      columns={columns}
      pagination={false}
      summary={() => (
        <Table.Summary.Row>
          <Table.Summary.Cell index={0}><Typography.Text strong>Total</Typography.Text></Table.Summary.Cell>
          <Table.Summary.Cell index={1} align="right">{num(total.views)}</Table.Summary.Cell>
          <Table.Summary.Cell index={2} align="right">{num(total.taps)}</Table.Summary.Cell>
          <Table.Summary.Cell index={3} align="right">{total.ctr}%</Table.Summary.Cell>
          <Table.Summary.Cell index={4} align="right">{num(total.orders)}</Table.Summary.Cell>
          <Table.Summary.Cell index={5} align="right">{num(total.units)}</Table.Summary.Cell>
          <Table.Summary.Cell index={6} align="right">{formatRupees(total.revenue)}</Table.Summary.Cell>
        </Table.Summary.Row>
      )}
    />
  );
}
