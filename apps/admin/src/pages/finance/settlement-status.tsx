import { Tag } from "antd";
import { SettlementStatusLabels, type SettlementStatus } from "@martly/shared/constants";

const COLORS: Record<string, string> = { DRAFT: "gold", APPROVED: "blue", PAID: "green", FAILED: "red", CARRIED_FORWARD: "default" };

export const SettlementStatusTag = ({ status }: { status: string }) => (
  <Tag color={COLORS[status]}>{SettlementStatusLabels[status as SettlementStatus] ?? status}</Tag>
);
