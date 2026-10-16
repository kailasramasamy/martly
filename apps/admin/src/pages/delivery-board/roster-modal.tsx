import { Empty, Modal, Select, Switch, Typography } from "antd";
import type { PlanRider, Wave } from "./types";

interface RosterModalProps {
  open: boolean;
  wave: Wave;
  allRiders: PlanRider[];
  date: string;
  canEdit: boolean;
  busyId: string | null;
  onToggle: (slotId: string, riderId: string, working: boolean) => void;
  onClose: () => void;
}

export function RosterModal({ open, wave, allRiders, date, canEdit, busyId, onToggle, onClose }: RosterModalProps) {
  const roster = wave.roster ?? [];
  const slotId = wave.slotId as string;
  const extras = allRiders.filter((r) => !roster.some((x) => x.id === r.id));

  return (
    <Modal title={`Riders for ${wave.label} on ${date}`} open={open} onCancel={onClose} footer={null} destroyOnClose>
      <Typography.Paragraph type="secondary">
        Changes here apply to this day only. The weekly roster lives under Riders &amp; trips.
      </Typography.Paragraph>
      {roster.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No riders rostered" />}
      {roster.map((r) => (
        <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
          <span>{r.name}{r.phone && <Typography.Text type="secondary"> {r.phone}</Typography.Text>}</span>
          <Switch checked disabled={!canEdit} loading={busyId === r.id} checkedChildren="Working" unCheckedChildren="Off" onChange={() => onToggle(slotId, r.id, false)} />
        </div>
      ))}
      {canEdit && (
        <Select
          style={{ width: "100%", marginTop: 12 }}
          placeholder="Add rider for today"
          value={null}
          disabled={extras.length === 0}
          options={extras.map((r) => ({ value: r.id, label: r.name }))}
          onChange={(riderId) => riderId && onToggle(slotId, riderId, true)}
        />
      )}
    </Modal>
  );
}
