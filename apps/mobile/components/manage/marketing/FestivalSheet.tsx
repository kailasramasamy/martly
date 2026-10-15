import { View, StyleSheet } from "react-native";
import { FESTIVAL_REGIONS, CollectionKindLabels } from "@martly/shared/constants";
import { BottomSheet } from "../../search/BottomSheet";
import { Button } from "../ui/Button";
import { KeyValue } from "../ui/KeyValue";
import { formatDate } from "../ui/dates";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useToast } from "../../../lib/toast-context";
import { TONES } from "./common";
import type { CurateResult, FestivalEvent } from "./types";

interface Props {
  event: FestivalEvent | null;
  canEdit: boolean;
  curating: boolean;
  onCurate: (event: FestivalEvent) => void;
  onEdit: (event: FestivalEvent) => void;
  onClose: () => void;
}

export function summarizeCuration(results: CurateResult[]): string {
  const count = (status: CurateResult["status"]) => results.filter((r) => r.status === status).length;
  const reasons = results.filter((r) => r.status === "skipped" && r.reason).map((r) => r.reason);
  const parts = `${count("created")} created, ${count("exists")} already exist, ${count("skipped")} skipped`;
  return reasons.length ? `${parts} (${reasons.join("; ")})` : parts;
}

/** Runs the AI curator for one event, then toasts the per-organization outcome */
export function useCuration(onCurated: () => Promise<unknown>) {
  const { run, running } = useAction();
  const toast = useToast();
  const curate = async (event: FestivalEvent) => {
    const results = await run(async () => (await api.post<CurateResult[]>(`/api/v1/festival-events/${event.id}/curate`, undefined)).data);
    if (!results) return false;
    await onCurated();
    toast.show(`${event.name}: ${summarizeCuration(results)}`, "success");
    return true;
  };
  return { curate, curating: running };
}

export function FestivalSheet({ event, canEdit, curating, onCurate, onEdit, onClose }: Props) {
  const ended = !!event && new Date(event.endsAt).getTime() < Date.now();
  return (
    <BottomSheet
      visible={!!event}
      title={event?.name ?? ""}
      onClose={onClose}
      footer={event ? (
        <View style={styles.footer}>
          <Button label="Curate now" icon="flash-outline" onPress={() => onCurate(event)} loading={curating} disabled={ended} style={styles.btn} />
          {canEdit ? <Button label="Edit" variant="secondary" icon="create-outline" onPress={() => onEdit(event)} style={styles.btn} /> : null}
        </View>
      ) : undefined}
    >
      {event ? (
        <View style={styles.body}>
          <KeyValue label="Kind" value={CollectionKindLabels[event.kind]} />
          <KeyValue label="Dates" value={`${formatDate(event.startsAt)} – ${formatDate(event.endsAt)}`} />
          <KeyValue label="Goes live" value={formatDate(event.liveFrom)} />
          <KeyValue label="Regions" value={event.regions.map((r) => FESTIVAL_REGIONS[r as keyof typeof FESTIVAL_REGIONS] ?? r).join(", ")} />
          {event.collections.length === 0 ? <KeyValue label="Curated" value="Not curated" /> : null}
          {event.collections.map((c) => (
            <KeyValue key={c.id} label={`${c.source === "AGENT" ? "AI \u00B7 " : ""}${c.title}`} value={c.isActive ? "Active" : "Vetoed"} valueColor={c.isActive ? TONES.green.color : TONES.red.color} />
          ))}
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingBottom: 8 },
  footer: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 8 },
  btn: { flex: 1 },
});
