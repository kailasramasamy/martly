import { colors } from "../../../constants/theme";

type Pill = { label: string; color: string; bg: string };

export const STORE_STATUS: Record<string, Pill> = {
  ACTIVE: { label: "Active", color: "#15803d", bg: "#dcfce7" },
  PENDING: { label: "Pending", color: "#b45309", bg: "#fef3c7" },
  SUSPENDED: { label: "Suspended", color: "#b91c1c", bg: "#fee2e2" },
  CLOSED: { label: "Closed", color: "#475569", bg: "#e2e8f0" },
};

export const STORE_STATUS_RAIL: Record<string, string> = {
  ACTIVE: colors.primary,
  PENDING: colors.accent,
  SUSPENDED: colors.error,
  CLOSED: "#94a3b8",
};

export const ROLE_PILL: Record<string, Pill> = {
  SUPER_ADMIN: { label: "Super admin", color: "#b91c1c", bg: "#fee2e2" },
  ORG_ADMIN: { label: "Org admin", color: "#1d4ed8", bg: "#dbeafe" },
  STORE_MANAGER: { label: "Store manager", color: "#15803d", bg: "#dcfce7" },
  STAFF: { label: "Staff", color: "#b45309", bg: "#fef3c7" },
  RIDER: { label: "Rider", color: "#0e7490", bg: "#cffafe" },
  CUSTOMER: { label: "Customer", color: "#475569", bg: "#e2e8f0" },
};

export const STORE_STATUS_OPTIONS = Object.entries(STORE_STATUS).map(([value, p]) => ({ value, label: p.label }));

export const ALL_ROLES = ["SUPER_ADMIN", "ORG_ADMIN", "STORE_MANAGER", "STAFF", "RIDER"];
export const ORG_ADMIN_ASSIGNABLE_ROLES = ["STORE_MANAGER", "STAFF", "RIDER"];

export const roleOptions = (roles: string[]) => roles.map((value) => ({ value, label: ROLE_PILL[value].label }));
