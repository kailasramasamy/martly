import { Alert, Button, Card, Col, Row, Space, Statistic, Tag, Tooltip, Typography } from "antd";
import dayjs from "dayjs";
import type { Wave } from "./types";

interface WaveSummaryProps {
  wave: Wave;
  canDispatch: boolean;
  busy: boolean;
  suggestedCount: number;
  overflow: number;
  onPlan: () => void;
  onAssignAll: () => void;
  onShowRiders: () => void;
}

function packingBreakdown(wave: Wave): string {
  const ready = wave.pool.filter((o) => o.status === "READY").length;
  const packing = wave.pool.length - ready;
  return `${ready} ready · ${packing} still packing`;
}

function Window({ wave }: { wave: Wave }) {
  const cutoff = wave.cutoffAt ? dayjs(wave.cutoffAt) : null;
  const passed = cutoff ? cutoff.isBefore(dayjs()) : false;
  const isSlot = wave.kind === "SLOT";
  return (
    <>
      <Col>
        <Statistic title="Window" value={isSlot ? wave.label : "Express"} valueStyle={{ fontSize: 18 }} />
      </Col>
      {cutoff && (
        <Col>
          <Statistic
            title="Cutoff"
            value={cutoff.format("HH:mm")}
            suffix={<Tag color={passed ? "default" : "green"}>{passed ? "passed" : "open"}</Tag>}
            valueStyle={{ fontSize: 18 }}
          />
        </Col>
      )}
      {isSlot && (
        <Col>
          <Statistic title="Booked" value={`${wave.booked ?? 0} / ${wave.capacity ?? 0}`} valueStyle={{ fontSize: 18 }} />
        </Col>
      )}
    </>
  );
}

function RosterLink({ wave, onShowRiders }: { wave: Wave; onShowRiders: () => void }) {
  return (
    <Col>
      <Typography.Text type="secondary" style={{ display: "block", fontSize: 14 }}>Riders today</Typography.Text>
      <Button type="link" style={{ padding: 0 }} onClick={onShowRiders}>
        {(wave.roster ?? []).map((r) => r.name.split(" ")[0]).join(", ") || "None"}
      </Button>
    </Col>
  );
}

type PlanButtonsProps = Pick<WaveSummaryProps, "wave" | "busy" | "suggestedCount" | "onPlan" | "onAssignAll">;

function PlanButtons({ wave, busy, suggestedCount, onPlan, onAssignAll }: PlanButtonsProps) {
  const hasPlanned = wave.trips.some((t) => t.status === "PLANNED" || t.status === "CREATED");
  const nothingToPlan = wave.pool.length === 0 && !hasPlanned;
  return (
    <Col flex="auto" style={{ textAlign: "right" }}>
      <Space wrap>
        <Tooltip title={nothingToPlan ? "No orders to plan" : undefined}>
          <span>
            <Button type="primary" loading={busy} disabled={nothingToPlan} onClick={onPlan}>
              {hasPlanned ? "Re-plan" : "Plan trips"}
            </Button>
          </span>
        </Tooltip>
        {suggestedCount > 0 && <Button loading={busy} onClick={onAssignAll}>Assign all ({suggestedCount})</Button>}
      </Space>
    </Col>
  );
}

function Warnings({ wave, overflow }: { wave: Wave; overflow: number }) {
  return (
    <>
      {wave.kind === "SLOT" && (wave.roster ?? []).length === 0 && (
        <Alert style={{ marginTop: 12 }} type="warning" showIcon message="No riders rostered for this window, so trips can't be planned." />
      )}
      {overflow > 0 && (
        <Alert
          style={{ marginTop: 12 }}
          type="warning"
          showIcon
          message={`${overflow} order${overflow === 1 ? "" : "s"} over rider capacity stay unplanned. Add a rider or raise trip limits, then re-plan.`}
        />
      )}
    </>
  );
}

export function WaveSummary({ wave, canDispatch, busy, suggestedCount, overflow, onPlan, onAssignAll, onShowRiders }: WaveSummaryProps) {
  return (
    <Card size="small">
      <Row gutter={[24, 12]} align="middle">
        <Window wave={wave} />
        {wave.kind === "SLOT" && <RosterLink wave={wave} onShowRiders={onShowRiders} />}
        <Col>
          <Statistic title="Unplanned" value={wave.pool.length} suffix={wave.pool.length ? <small>{packingBreakdown(wave)}</small> : undefined} valueStyle={{ fontSize: 18 }} />
        </Col>
        {canDispatch && <PlanButtons wave={wave} busy={busy} suggestedCount={suggestedCount} onPlan={onPlan} onAssignAll={onAssignAll} />}
      </Row>
      <Warnings wave={wave} overflow={overflow} />
    </Card>
  );
}
