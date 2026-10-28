import { useState, type ReactElement } from "react";
import { Button, InputNumber, Popover, Space } from "antd";

const DEFAULT_PERCENT = 5;
const MAX_PERCENT = 90;

/** Wraps a trigger: asks how far under MRP, then hands the percent back */
export const PercentOffPopover = ({ onApply, children }: { onApply: (percent: number) => void; children: ReactElement }) => {
  const [open, setOpen] = useState(false);
  const [percent, setPercent] = useState<number>(DEFAULT_PERCENT);

  return (
    <Popover
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      title="Set price below MRP"
      content={
        <Space>
          <InputNumber min={0} max={MAX_PERCENT} precision={0} value={percent} onChange={(v) => setPercent(v ?? 0)} suffix="% off" style={{ width: 120 }} />
          <Button
            type="primary"
            onClick={() => {
              setOpen(false);
              onApply(percent);
            }}
          >
            Apply
          </Button>
        </Space>
      }
    >
      {children}
    </Popover>
  );
};
