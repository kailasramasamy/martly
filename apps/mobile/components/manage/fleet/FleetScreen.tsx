import { useState, type ReactNode } from "react";
import { SectionCard } from "../ui/SectionCard";
import { ManageStackScreen } from "../ManageStackScreen";
import { useResource } from "../../../lib/manage/use-resource";
import type { FleetSettings } from "../delivery/plan/types";
import { FleetRulesCard } from "./FleetRulesCard";
import { RosterCard } from "./RosterCard";
import { WindowEditor } from "./WindowEditor";
import { groupWindows } from "./windows";
import type { RosterData, RosterWindow } from "./types";

interface FleetScreenProps {
  storeId: string;
  storeField: ReactNode;
}

/** Riders & trips setup: fleet rules above, the weekly roster below */
export function FleetScreen({ storeId, storeField }: FleetScreenProps) {
  const settings = useResource<FleetSettings>(`/api/v1/delivery-plan/settings?storeId=${storeId}`);
  const roster = useResource<RosterData>(`/api/v1/delivery-plan/roster?storeId=${storeId}`);
  const [editing, setEditing] = useState<RosterWindow | null>(null);
  const windows = groupWindows(roster.data?.slots ?? []);
  const loading = settings.loading || roster.loading;
  const reload = () => { settings.reload(); roster.reload(); };
  const saved = () => { setEditing(null); roster.reload(); };

  return (
    <ManageStackScreen title="Riders & trips" loading={loading} error={settings.error ?? roster.error} onRetry={reload}>
      <SectionCard>{storeField}</SectionCard>
      {settings.data && <FleetRulesCard key={storeId} storeId={storeId} settings={settings.data} onSaved={settings.reload} />}
      {roster.data && <RosterCard windows={windows} riders={roster.data.riders} onEdit={setEditing} />}
      <WindowEditor storeId={storeId} window={editing} riders={roster.data?.riders ?? []} onClose={() => setEditing(null)} onSaved={saved} />
    </ManageStackScreen>
  );
}
