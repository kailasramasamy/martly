import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../../../../lib/api";
import { useAction } from "../../../../lib/manage/use-action";
import { usePagedList } from "../../../../lib/manage/use-paged-list";
import { useResource } from "../../../../lib/manage/use-resource";
import { ManageListScreen } from "../../ManageListScreen";
import { HeaderAction } from "../../HeaderAction";
import { ListRow } from "../../ui/ListRow";
import { SelectField } from "../../ui/SelectField";
import { amountColor, signedINR } from "../../finance/format";
import { AdjustSheet } from "./AdjustSheet";
import { MEMO_PREFIX, type Adjustment } from "./types";

const ALL = "";

const dateOf = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export function AdjustmentsTab({ tabs }: { tabs: ReactNode }) {
  const [q, setQ] = useState("");
  const [organizationId, setOrganizationId] = useState(ALL);
  const [open, setOpen] = useState(false);
  const { run, running } = useAction();
  const orgs = useResource<{ id: string; name: string }[]>("/api/v1/organizations?pageSize=100");
  const orgOptions = useMemo(() => (orgs.data ?? []).map((o) => ({ value: o.id, label: o.name })), [orgs.data]);
  const list = usePagedList<Adjustment>("/api/v1/ledger/platform/adjustments", { q: q.trim() || undefined, organizationId: organizationId || undefined }, { pageSize: 30 });

  const record = async (input: unknown) => {
    if (!(await run(() => api.post("/api/v1/ledger/platform/adjustments", input), "Adjustment recorded"))) return;
    setOpen(false);
    list.reload();
  };

  return (
    <>
      <ManageListScreen
        title="Platform payouts"
        list={list}
        search={{ value: q, onChange: setQ, placeholder: "Search reason" }}
        filters={
          <>
            {tabs}
            <SelectField label="Organization" value={organizationId} options={[{ value: ALL, label: "All organizations" }, ...orgOptions]} onChange={setOrganizationId} />
          </>
        }
        headerRight={() => <HeaderAction accessibilityLabel="Record adjustment" onPress={() => setOpen(true)} />}
        empty={{ icon: "create-outline", title: "No adjustments yet" }}
        renderItem={(a) => (
          <ListRow
            title={a.organizationName}
            subtitle={a.memo?.replace(MEMO_PREFIX, "") ?? "—"}
            caption={`${a.storeName ?? "All stores"} · ${a.createdByName ?? "—"} · ${dateOf(a.createdAt)}`}
            value={signedINR(a.amount, { decimals: true })}
            valueColor={amountColor(a.amount)}
          />
        )}
      />
      <AdjustSheet visible={open} orgs={orgOptions} running={running} onSubmit={record} onClose={() => setOpen(false)} />
    </>
  );
}
