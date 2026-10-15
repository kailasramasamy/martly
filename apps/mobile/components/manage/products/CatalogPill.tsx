import { StatusPill } from "../ui/StatusPill";

const MASTER = { label: "Master", color: "#1d4ed8", bg: "#dbeafe" };
const ORG = { label: "Org", color: "#6d28d9", bg: "#ede9fe" };

export function CatalogPill({ organizationId }: { organizationId: string | null }) {
  return <StatusPill {...(organizationId ? ORG : MASTER)} />;
}
