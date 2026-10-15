import {
  CheckCircleOutlined,
  FireOutlined,
  GiftOutlined,
  CarOutlined,
  SmileOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import { createElement } from "react";
import { NEXT_ACTION_LABELS } from "@martly/shared/order-flow";

const ICONS: Record<string, typeof CheckCircleOutlined> = {
  CONFIRMED: CheckCircleOutlined,
  PREPARING: FireOutlined,
  READY: GiftOutlined,
  OUT_FOR_DELIVERY: CarOutlined,
  DELIVERED: SmileOutlined,
  CANCELLED: CloseCircleOutlined,
};

export const NEXT_ACTION: Record<string, { label: string; pickupLabel?: string; icon: React.ReactNode; color: string }> =
  Object.fromEntries(
    Object.entries(NEXT_ACTION_LABELS).map(([status, meta]) => [status, { ...meta, icon: createElement(ICONS[status]) }]),
  );
