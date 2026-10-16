import { useEffect, useState } from "react";
import { Checkbox, Modal, Select, Typography, message } from "antd";
import { axiosInstance } from "../../providers/data-provider";
import { WEEK_DAYS } from "./types";
import type { FleetRider, SlotWindow } from "./types";

interface SlotRosterModalProps {
  storeId: string;
  window: SlotWindow | null;
  initialDay: number;
  riders: FleetRider[];
  onClose: () => void;
  onSaved: () => void;
}

interface RosterFieldsProps {
  win: SlotWindow | null;
  riders: FleetRider[];
  riderIds: string[];
  days: number[];
  onRiders: (ids: string[]) => void;
  onDays: (days: number[]) => void;
}

function RosterFields({ win, riders, riderIds, days, onRiders, onDays }: RosterFieldsProps) {
  return (
    <>
      <Typography.Text strong>Riders</Typography.Text>
      <Select
        mode="multiple"
        style={{ width: "100%", margin: "8px 0 16px" }}
        placeholder="Choose riders"
        value={riderIds}
        onChange={onRiders}
        optionFilterProp="label"
        options={riders.map((r) => ({ value: r.id, label: r.name }))}
      />
      <Typography.Text strong>Applies on</Typography.Text>
      <div style={{ marginTop: 8 }}>
        <Checkbox.Group
          value={days}
          onChange={(v) => onDays(v as number[])}
          options={WEEK_DAYS.map((d) => ({ value: d.value, label: d.label, disabled: !win?.byDay.has(d.value) }))}
        />
      </div>
    </>
  );
}

export function SlotRosterModal({ storeId, window: win, initialDay, riders, onClose, onSaved }: SlotRosterModalProps) {
  const [riderIds, setRiderIds] = useState<string[]>([]);
  const [days, setDays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!win) return;
    setDays([initialDay]);
    setRiderIds(win.byDay.get(initialDay)?.riderIds ?? []);
  }, [win, initialDay]);

  const save = async () => {
    if (!win) return;
    const slotIds = days.flatMap((d) => win.byDay.get(d)?.id ?? []);
    setSaving(true);
    try {
      await axiosInstance.put("/delivery-plan/roster", { storeId, slotIds, riderIds });
      message.success("Roster saved");
      onSaved();
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? "Failed to save roster");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={win ? `Riders for ${win.startTime}–${win.endTime}` : ""}
      open={!!win}
      onCancel={onClose}
      onOk={save}
      okText="Save roster"
      okButtonProps={{ loading: saving, disabled: days.length === 0 }}
      destroyOnClose
    >
      <RosterFields win={win} riders={riders} riderIds={riderIds} days={days} onRiders={setRiderIds} onDays={setDays} />
    </Modal>
  );
}
