import { Button, Space, Typography, theme } from "antd";
import { PercentOffPopover } from "./percent-off";

interface Props {
  count: number;
  canHide: boolean;
  onConfirm: () => void;
  onPercent: (percent: number) => void;
  onHide: () => void;
  onReopen: () => void;
  onClear: () => void;
}

/** Sticks to the bottom of the screen while rows are ticked */
export const SelectionBar = ({ count, canHide, onConfirm, onPercent, onHide, onReopen, onClear }: Props) => {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        zIndex: 5,
        padding: "10px 16px",
        marginTop: 12,
        background: token.colorBgElevated,
        border: `1px solid ${token.colorPrimary}`,
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowSecondary,
      }}
    >
      <Space wrap>
        <Typography.Text strong>{count} selected</Typography.Text>
        <Button type="primary" onClick={onConfirm}>Mark OK</Button>
        <PercentOffPopover onApply={onPercent}><Button>Set % off MRP</Button></PercentOffPopover>
        {canHide && <Button danger onClick={onHide}>Hide</Button>}
        <Button onClick={onReopen}>Reopen</Button>
        <Button type="link" onClick={onClear}>Clear</Button>
      </Space>
    </div>
  );
};
