import { useEffect, useState } from "react";
import { useGetIdentity } from "@refinedev/core";
import { Select, Typography } from "antd";
import { axiosInstance } from "../../providers/data-provider";
import { formatRupees } from "../promos/promo-utils";

export { errorMessage } from "../marketing/utils";
export { formatRupees };

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:7001";

/** A signed ₹ amount: credits read +, debits read − */
export const signedRupees = (n: number) => `${n < 0 ? "−" : "+"}${formatRupees(Math.abs(n))}`;
export const amountColor = (n: number) => (n < 0 ? "#dc2626" : "#16a34a");

export function SignedAmount({ value }: { value: number }) {
  return <Typography.Text strong style={{ color: amountColor(value) }}>{signedRupees(value)}</Typography.Text>;
}

/** Saves a response blob as a file in the browser */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface OrgOption { id: string; name: string }

/** Super admins look at one organization at a time; everyone else is already scoped by their token */
export function useFinanceOrg() {
  const { data: identity } = useGetIdentity<{ role: string }>();
  const isSuperAdmin = identity?.role === "SUPER_ADMIN";
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [organizationId, setOrganizationId] = useState<string>();

  useEffect(() => {
    if (!isSuperAdmin) return;
    axiosInstance.get("/organizations", { params: { pageSize: 100 } }).then((res) => setOrgs(res.data.data));
  }, [isSuperAdmin]);

  const picker = isSuperAdmin ? (
    <Select
      showSearch
      optionFilterProp="label"
      placeholder="Choose an organization"
      style={{ width: 260 }}
      value={organizationId}
      onChange={setOrganizationId}
      options={orgs.map((o) => ({ value: o.id, label: o.name }))}
    />
  ) : null;

  const ready = identity !== undefined && (!isSuperAdmin || !!organizationId);
  return { isSuperAdmin, organizationId, picker, ready };
}
