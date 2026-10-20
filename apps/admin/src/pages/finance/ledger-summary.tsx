import { Alert, Card, Col, Row, Statistic, Typography } from "antd";
import dayjs from "dayjs";
import { SettlementStatusLabels, type SettlementStatus } from "@martly/shared/constants";
import { formatRupees } from "./utils";
import type { LedgerSummary } from "./types";

const money = (v: number | string) => formatRupees(Number(v));
const day = (v: string) => dayjs(v).format("D MMM YYYY");

function Stat({ title, value, note }: { title: string; value: number; note?: string }) {
  return (
    <Card size="small">
      <Statistic title={title} value={value} formatter={(v) => money(v)} />
      {note && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{note}</Typography.Text>}
    </Card>
  );
}

function OwnerStats({ owner, nextRunAt }: { owner: NonNullable<LedgerSummary["owner"]>; nextRunAt: string }) {
  const { nextPayout, lastPayout } = owner;
  return (
    <>
      <Col xs={12} md={8} xl={4}><Stat title="Carried" value={owner.carried} note="Rolled into the next payout" /></Col>
      <Col xs={12} md={8} xl={4}>
        <Stat
          title="Next payout"
          value={nextPayout?.amount ?? 0}
          note={nextPayout ? `${nextPayout.number} · ${SettlementStatusLabels[nextPayout.status as SettlementStatus]}` : `Next run ${dayjs(nextRunAt).format("ddd D MMM, h:mm A")}`}
        />
      </Col>
      <Col xs={12} md={8} xl={4}>
        <Stat
          title="Last payout"
          value={lastPayout?.amount ?? 0}
          note={lastPayout ? `${day(lastPayout.paidAt)}${lastPayout.utr ? ` · UTR ${lastPayout.utr}` : ""}` : "No payouts yet"}
        />
      </Col>
    </>
  );
}

export function LedgerSummaryCards({ summary }: { summary: LedgerSummary }) {
  return (
    <>
      {summary.owner?.due && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={`${money(summary.owner.due.amount)} is due to Martly`}
          description="Your balance has stayed negative. The owner can pay this from the Martly app."
        />
      )}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={8} xl={4}><Stat title="Available" value={summary.available} note="Ready for the next payout" /></Col>
        <Col xs={12} md={8} xl={4}><Stat title="On hold" value={summary.onHold} note="Inside the return window" /></Col>
        {summary.owner && <OwnerStats owner={summary.owner} nextRunAt={summary.nextRunAt} />}
        <Col xs={12} md={8} xl={4}><Stat title="COD collected this week" value={summary.codThisWeek} note="Cash you already hold" /></Col>
      </Row>
      <Typography.Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
        Martly commission: {summary.commission.onlinePct}% on online payments, {summary.commission.codPct}% on COD and wallet (GST included)
      </Typography.Text>
    </>
  );
}
