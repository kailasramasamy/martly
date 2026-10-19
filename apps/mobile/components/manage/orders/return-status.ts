export const RETURN_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: "Pending", color: "#b45309", bg: "#fef3c7" },
  IN_PROGRESS: { label: "In progress", color: "#1d4ed8", bg: "#dbeafe" },
  APPROVED: { label: "Completed", color: "#15803d", bg: "#dcfce7" },
  REJECTED: { label: "Rejected", color: "#b91c1c", bg: "#fee2e2" },
  EXPIRED: { label: "Expired", color: "#475569", bg: "#f1f5f9" },
};
