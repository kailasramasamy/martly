import { Button, Descriptions, Drawer, Space, Spin, Table, Tag, Typography } from "antd";
import { FileTextOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { LedgerEntryTypeLabels, SettlementStatusLabels, type LedgerEntryType, type SettlementStatus } from "@martly/shared/constants";
import { API_URL, SignedAmount, formatRupees } from "./utils";
import { SettlementStatusTag } from "./settlement-status";
import type { SettlementDetail } from "./types";

const day = (v: string) => dayjs(v).format("D MMM YYYY");

function StoreBreakdown({ detail }: { detail: SettlementDetail }) {
  return (
    <>
      {detail.stores.map((s) => (
        <div key={s.storeId} style={{ marginBottom: 16 }}>
          <Typography.Text strong>{s.name}</Typography.Text>
          <Table
            size="small"
            rowKey="type"
            pagination={false}
            dataSource={s.lines}
            summary={() => (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={2}><strong>Store total</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right"><SignedAmount value={Number(s.total)} /></Table.Summary.Cell>
              </Table.Summary.Row>
            )}
            columns={[
              { title: "Type", dataIndex: "type", render: (v: LedgerEntryType) => LedgerEntryTypeLabels[v] ?? v },
              { title: "Entries", dataIndex: "count", width: 80 },
              { title: "Amount", dataIndex: "amount", align: "right" as const, render: (v: number) => <SignedAmount value={Number(v)} /> },
            ]}
          />
        </div>
      ))}
    </>
  );
}

interface Props {
  detail: SettlementDetail | null;
  loading: boolean;
  onClose: () => void;
  onOpen: (id: string) => void;
}

export function SettlementDrawer({ detail, loading, onClose, onOpen }: Props) {
  return (
    <Drawer open title={detail ? `Settlement ${detail.number}` : "Settlement"} width={640} onClose={onClose}
      extra={detail && <Button icon={<FileTextOutlined />} onClick={() => window.open(`${API_URL}${detail.statementUrl}`, "_blank", "noopener")}>Open statement</Button>}>
      {loading || !detail ? <Spin style={{ display: "block", margin: "48px auto" }} /> : (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Period">{day(detail.periodStart)} – {day(detail.periodEnd)}</Descriptions.Item>
            <Descriptions.Item label="Status"><SettlementStatusTag status={detail.status} /></Descriptions.Item>
            <Descriptions.Item label="Credits">{formatRupees(Number(detail.credits))}</Descriptions.Item>
            <Descriptions.Item label="Debits">{formatRupees(Math.abs(Number(detail.debits)))}</Descriptions.Item>
            <Descriptions.Item label="Carried in">{formatRupees(Number(detail.carriedIn))}</Descriptions.Item>
            <Descriptions.Item label="Net payout"><strong>{formatRupees(Number(detail.net))}</strong></Descriptions.Item>
            {detail.utr && <Descriptions.Item label="UTR">{detail.utr}</Descriptions.Item>}
            {detail.paidAt && <Descriptions.Item label="Paid on">{day(detail.paidAt)}</Descriptions.Item>}
            {detail.failureReason && <Descriptions.Item label="Failure reason">{detail.failureReason}</Descriptions.Item>}
          </Descriptions>
          {detail.carriedFrom.length > 0 && (
            <div>
              <Typography.Text strong>Carried from</Typography.Text>
              <div>
                {detail.carriedFrom.map((c) => (
                  <Tag key={c.id} style={{ cursor: "pointer" }} onClick={() => onOpen(c.id)}>
                    {c.number} · {formatRupees(Number(c.net))} · {SettlementStatusLabels[c.status as SettlementStatus]}
                  </Tag>
                ))}
              </div>
            </div>
          )}
          <StoreBreakdown detail={detail} />
        </Space>
      )}
    </Drawer>
  );
}
