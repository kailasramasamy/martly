import { useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { can } from "@martly/shared/permissions";
import { ManageListScreen } from "../../../components/manage/ManageListScreen";
import { HeaderAction } from "../../../components/manage/HeaderAction";
import { ListRow } from "../../../components/manage/ui/ListRow";
import { StatusPill } from "../../../components/manage/ui/StatusPill";
import { KpiTile } from "../../../components/manage/ui/KpiTile";
import { formatDate } from "../../../components/manage/ui/dates";
import { GroupHeader, TONES, type Tone } from "../../../components/manage/marketing/common";
import { FestivalSheet, useCuration } from "../../../components/manage/marketing/FestivalSheet";
import type { FestivalEvent, FestivalSummary } from "../../../components/manage/marketing/types";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { useResource } from "../../../lib/manage/use-resource";
import { useAuth } from "../../../lib/auth-context";

type Row = FestivalEvent | { id: string; header: string };

const PHASE: Record<FestivalEvent["phase"], Tone> = {
  LIVE: { label: "Live now", ...TONES.green },
  UPCOMING: { label: "Upcoming", ...TONES.blue },
  ENDED: { label: "Ended", ...TONES.slate },
};

const monthLabel = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
const groupOf = (e: FestivalEvent) => (e.phase === "LIVE" ? "Live now" : `${e.phase === "ENDED" ? "Ended · " : ""}${monthLabel(e.startsAt)}`);

function withMonthHeaders(items: FestivalEvent[]): Row[] {
  const rows: Row[] = [];
  let current = "";
  for (const e of items) {
    const group = groupOf(e);
    if (group !== current) {
      current = group;
      rows.push({ id: `h:${group}`, header: group });
    }
    rows.push(e);
  }
  return rows;
}

function curatedTone(e: FestivalEvent): Tone {
  if (e.collections.length === 0) return { label: "Not curated", ...TONES.slate };
  return e.collections.some((c) => c.isActive) ? { label: "Curated", ...TONES.green } : { label: "Vetoed", ...TONES.red };
}

function SummaryTiles({ summary }: { summary: FestivalSummary | null }) {
  return (
    <View style={styles.tiles}>
      <KpiTile label="Live now" value={String(summary?.live ?? 0)} />
      <KpiTile label="Next 30 days" value={String(summary?.upcoming30d ?? 0)} />
      <KpiTile label="Curated" value={String(summary?.curated ?? 0)} />
    </View>
  );
}

export default function FestivalEventsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const canEdit = can(user, "festival-events", "edit");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<FestivalEvent | null>(null);
  const list = usePagedList<FestivalEvent>("/api/v1/festival-events", { q }, { pageSize: 100 });
  const summary = useResource<FestivalSummary>("/api/v1/festival-events/summary");
  const rows = useMemo(() => withMonthHeaders(list.items), [list.items]);
  const { curate, curating } = useCuration(() => Promise.all([list.refresh(), summary.reload()]));

  return (
    <>
      <ManageListScreen<Row>
        title="Festival calendar"
        list={{ ...list, items: rows }}
        search={{ value: q, onChange: setQ, placeholder: "Search festival or region" }}
        filters={<SummaryTiles summary={summary.data} />}
        headerRight={canEdit ? () => <HeaderAction onPress={() => router.push("/manage/festival-events/new")} accessibilityLabel="New festival" /> : undefined}
        empty={{ icon: "calendar-outline", title: "No festivals found", message: "Festival events appear here once the calendar is seeded." }}
        renderItem={(row) => {
          if ("header" in row) return <GroupHeader label={row.header} />;
          const phase = PHASE[row.phase];
          const curated = curatedTone(row);
          return (
            <ListRow
              title={row.name}
              subtitle={`${formatDate(row.startsAt)} – ${formatDate(row.endsAt)}`}
              caption={`${curated.label}${row.isActive ? "" : " · Inactive"}`}
              railColor={phase.color}
              trailing={<StatusPill {...phase} dot={row.phase === "LIVE"} />}
              onPress={() => setSelected(row)}
              chevron
            />
          );
        }}
      />
      <FestivalSheet
        event={selected}
        canEdit={canEdit}
        curating={curating}
        onCurate={async (e) => { if (await curate(e)) setSelected(null); }}
        onEdit={(e) => { setSelected(null); router.push(`/manage/festival-events/${e.id}`); }}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: "row", gap: 10 },
});
