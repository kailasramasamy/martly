export const TRIP_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  CREATED: { label: "Not started", color: "#b45309", bg: "#fef3c7" },
  IN_PROGRESS: { label: "On the road", color: "#6d28d9", bg: "#ede9fe" },
  COMPLETED: { label: "Completed", color: "#15803d", bg: "#dcfce7" },
  CANCELLED: { label: "Cancelled", color: "#b91c1c", bg: "#fee2e2" },
};
