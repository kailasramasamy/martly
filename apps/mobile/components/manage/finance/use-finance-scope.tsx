import { useAuth } from "../../../lib/auth-context";
import { useManageScope } from "../../../lib/manage-scope-context";
import { SelectField } from "../ui/SelectField";

/** Query scope for ledger endpoints: the picked store, plus the organization the platform admin is looking at */
export function useFinanceScope() {
  const { user } = useAuth();
  const { storeId, organizationId, stores, allowAllStores, setStoreId } = useManageScope();
  const isOwner = user?.role === "ORG_ADMIN" || user?.role === "SUPER_ADMIN";
  const query = { storeId, organizationId: user?.role === "SUPER_ADMIN" ? organizationId : undefined };

  const picker = stores.length > 1 ? (
    <SelectField
      value={storeId ?? ""}
      options={[
        ...(allowAllStores ? [{ value: "", label: "All stores" }] : []),
        ...stores.map((s) => ({ value: s.id, label: s.name })),
      ]}
      onChange={(v) => setStoreId(v || null)}
    />
  ) : null;

  return { query, isOwner, picker };
}
