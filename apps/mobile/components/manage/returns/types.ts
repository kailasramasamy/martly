export type ReturnStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface ReturnRequestRow {
  id: string;
  status: ReturnStatus;
  reason: string;
  description: string | null;
  requestedAmount: string;
  approvedAmount: string | null;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  order: { id: string; totalAmount: string; createdAt: string };
  user: { id: string; name: string; email: string; phone: string | null };
  store: { id: string; name: string };
}

export interface ReturnRequestDetail extends ReturnRequestRow {
  images: string[];
  items: {
    id: string;
    quantity: number;
    orderItem: {
      id: string;
      unitPrice: string;
      product: { name: string };
      variant: { name: string };
    };
  }[];
}

export const RETURN_STATUS: Record<ReturnStatus, { label: string; color: string; bg: string }> = {
  PENDING: { label: "Pending", color: "#b45309", bg: "#fef3c7" },
  APPROVED: { label: "Approved", color: "#15803d", bg: "#dcfce7" },
  REJECTED: { label: "Rejected", color: "#b91c1c", bg: "#fee2e2" },
};

export function reasonLabel(reason: string): string {
  const text = reason.replace(/_/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
