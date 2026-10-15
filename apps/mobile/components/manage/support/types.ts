export type TicketStatus = "OPEN" | "RESOLVED" | "CLOSED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH";

export interface TicketRow {
  id: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  user: { id: string; name: string; email: string; phone: string | null };
  store: { id: string; name: string } | null;
  order: { id: string; status: string; totalAmount: string } | null;
}

export interface TicketMessage {
  role: "user" | "assistant" | "admin";
  content: string;
  timestamp: string;
}

export interface TicketDetail extends TicketRow {
  messages: TicketMessage[];
  order: (NonNullable<TicketRow["order"]> & { paymentStatus: string; createdAt: string }) | null;
}

export interface TicketStats {
  total: number;
  open: number;
  resolved: number;
  closed: number;
}

export const TICKET_STATUS: Record<TicketStatus, { label: string; color: string; bg: string }> = {
  OPEN: { label: "Open", color: "#b45309", bg: "#fef3c7" },
  RESOLVED: { label: "Resolved", color: "#15803d", bg: "#dcfce7" },
  CLOSED: { label: "Closed", color: "#475569", bg: "#e2e8f0" },
};

export const TICKET_PRIORITY: Record<TicketPriority, { label: string; color: string; bg: string }> = {
  LOW: { label: "Low", color: "#475569", bg: "#e2e8f0" },
  MEDIUM: { label: "Medium", color: "#1d4ed8", bg: "#dbeafe" },
  HIGH: { label: "High", color: "#b91c1c", bg: "#fee2e2" },
};
