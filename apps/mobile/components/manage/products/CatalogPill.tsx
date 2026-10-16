import { StatusPill } from "../ui/StatusPill";

const MASTER = { label: "Master", color: "#1d4ed8", bg: "#dbeafe" };
const LOCAL = { label: "Local", color: "#6d28d9", bg: "#ede9fe" };

/** Master = shared platform catalog; Local = created by this organization */
export function CatalogPill({ organizationId }: { organizationId: string | null }) {
  return <StatusPill {...(organizationId ? LOCAL : MASTER)} />;
}
