import { Button, Popconfirm, Progress, Space, Table, Typography } from "antd";
import type { StockCheckDepartment } from "@martly/shared/types";
import { count, type StockCheckActions } from "./api";
import { Counts, Thumbs, confirmedPct } from "./cells";

interface Props {
  departments: StockCheckDepartment[];
  loading: boolean;
  actions: StockCheckActions;
  onPick: (id: string) => void;
}

/** One row per department: settle the lot in a click, or open its brands */
export const DepartmentsTable = ({ departments, loading, actions, onPick }: Props) => (
  <Table<StockCheckDepartment>
    rowKey="id"
    size="small"
    dataSource={departments}
    loading={loading}
    pagination={false}
    locale={{ emptyText: "Pick a store to check its range" }}
    columns={[
      { title: "Department", render: (_, d) => <Space><Thumbs images={d.sampleImages} /><Typography.Text strong>{d.name}</Typography.Text></Space> },
      { title: "Confirmed", width: 200, render: (_, d) => <Progress size="small" percent={confirmedPct(d)} /> },
      { title: "Products", width: 360, render: (_, d) => <Counts c={d} /> },
      {
        title: "Actions",
        render: (_, d) => (
          <Space size={4} wrap>
            <Button size="small" type="primary" disabled={d.unchecked === 0} onClick={() => actions.decide([{ departmentId: d.id }], true)}>All carried</Button>
            <Popconfirm
              title={`Hide ${count(d.unchecked)} ${d.name} products?`}
              okText="Hide"
              okButtonProps={{ danger: true }}
              disabled={d.unchecked === 0}
              onConfirm={() => actions.decide([{ departmentId: d.id }], false)}
            >
              <Button size="small" danger disabled={d.unchecked === 0}>None</Button>
            </Popconfirm>
            <Button size="small" onClick={() => onPick(d.id)}>Brands →</Button>
          </Space>
        ),
      },
    ]}
  />
);
