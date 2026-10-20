import type { RefundDestination, ReturnMethod, ReturnRemedy } from "@martly/shared/constants";

export type ReturnStatus = "PENDING" | "IN_PROGRESS" | "APPROVED" | "REJECTED" | "EXPIRED";

export interface ReturnRequestRow {
  id: string;
  status: ReturnStatus;
  reason: string;
  description: string | null;
  requestedAmount: string;
  approvedAmount: string | null;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  remedy: ReturnRemedy | null;
  method: ReturnMethod | null;
  refundTo: RefundDestination;
  receivedAt: string | null;
  receivedBy: string | null;
  collectedOnOrderId: string | null;
  refundedAt: string | null;
  order: { id: string; totalAmount: string; createdAt: string };
  user: { id: string; name: string; email: string; phone: string | null };
  store: { id: string; name: string };
}

export interface ReturnReceiver {
  id: string;
  name: string | null;
  phone: string | null;
  role: string;
}

export interface ReturnRequestDetail extends ReturnRequestRow {
  images: string[];
  store: { id: string; name: string; returnKeepThreshold: string | null };
  replacementItems: { orderId: string; order: { status: string } }[];
  receiver: ReturnReceiver | null;
  items: {
    id: string;
    quantity: number;
    restock: boolean;
    orderItem: {
      id: string;
      unitPrice: string;
      product: { name: string; imageUrl?: string | null; images?: string[] };
      variant: { name: string; imageUrl?: string | null };
    };
  }[];
}

export const RETURN_STATUS: Record<ReturnStatus, { label: string; color: string; bg: string }> = {
  PENDING: { label: "Pending", color: "#b45309", bg: "#fef3c7" },
  IN_PROGRESS: { label: "In progress", color: "#1d4ed8", bg: "#dbeafe" },
  APPROVED: { label: "Completed", color: "#15803d", bg: "#dcfce7" },
  REJECTED: { label: "Rejected", color: "#b91c1c", bg: "#fee2e2" },
  EXPIRED: { label: "Expired", color: "#475569", bg: "#f1f5f9" },
};

export function reasonLabel(reason: string): string {
  const text = reason.replace(/_/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
