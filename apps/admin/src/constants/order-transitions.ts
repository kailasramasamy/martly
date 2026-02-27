import {
  CheckCircleOutlined,
  FireOutlined,
  GiftOutlined,
  CarOutlined,
  SmileOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import { createElement } from "react";

export const DELIVERY_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export const PICKUP_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export const NEXT_ACTION: Record<string, { label: string; pickupLabel?: string; icon: React.ReactNode; color: string }> = {
  CONFIRMED: { label: "Confirm Order", icon: createElement(CheckCircleOutlined), color: "#3b82f6" },
  PREPARING: { label: "Start Preparing", icon: createElement(FireOutlined), color: "#06b6d4" },
  READY: { label: "Mark Ready", pickupLabel: "Mark Ready for Pickup", icon: createElement(GiftOutlined), color: "#6366f1" },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", icon: createElement(CarOutlined), color: "#8b5cf6" },
  DELIVERED: { label: "Mark Delivered", pickupLabel: "Mark Picked Up", icon: createElement(SmileOutlined), color: "#22c55e" },
  CANCELLED: { label: "Cancel Order", icon: createElement(CloseCircleOutlined), color: "#ef4444" },
};
