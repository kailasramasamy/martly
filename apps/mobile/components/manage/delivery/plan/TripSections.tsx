import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../../../../constants/theme";
import { SectionCard } from "../../ui/SectionCard";
import { tabular } from "../../ui/tokens";
import { DoneTripCard } from "./DoneTripCard";
import { StopRow } from "./StopRow";
import { TripPlanCard, type TripHandlers } from "./TripPlanCard";
import type { PlanStop, PlanTrip, TripPhase } from "./types";

const GROUPS: { title: string; status: TripPhase }[] = [
  { title: "Planned", status: "PLANNED" },
  { title: "Assigned", status: "CREATED" },
  { title: "On the road", status: "IN_PROGRESS" },
];

function Heading({ title, count }: { title: string; count: number }) {
  return <Text style={styles.heading}>{title} <Text style={tabular}>{count}</Text></Text>;
}

/** Planned, assigned and on-the-road trips, then a summary of each finished one */
export function TripSections({ trips, handlers }: { trips: PlanTrip[]; handlers: TripHandlers }) {
  const done = trips.filter((t) => t.status === "COMPLETED");
  return (
    <>
      {GROUPS.map(({ title, status }) => {
        const group = trips.filter((t) => t.status === status);
        return group.length === 0 ? null : (
          <View key={status} style={styles.group}>
            <Heading title={title} count={group.length} />
            {group.map((t) => <TripPlanCard key={t.id} trip={t} handlers={handlers} />)}
          </View>
        );
      })}
      {done.length > 0 && (
        <View style={styles.group}>
          <Heading title="Done" count={done.length} />
          {done.map((t) => <DoneTripCard key={t.id} trip={t} onOpenStop={(s) => handlers.onOpenStop(s, t.id)} />)}
        </View>
      )}
    </>
  );
}

/** Orders in the wave that aren't on any trip yet */
export function PoolSection({ pool, onOpen }: { pool: PlanStop[]; onOpen: (stop: PlanStop) => void }) {
  if (pool.length === 0) return null;
  return (
    <View style={styles.group}>
      <Heading title="Not planned" count={pool.length} />
      <SectionCard flush>
        {pool.map((s) => <StopRow key={s.id} stop={s} onPress={() => onOpen(s)} />)}
      </SectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 10 },
  heading: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.9, textTransform: "uppercase", color: colors.textSecondary },
});
