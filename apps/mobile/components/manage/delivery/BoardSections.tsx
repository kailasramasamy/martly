import { Text, StyleSheet } from "react-native";
import { fonts } from "../../../constants/theme";
import { SectionCard } from "../ui/SectionCard";
import { manage } from "../ui/tokens";
import { DispatchRow } from "./DispatchRow";
import { TripCard } from "./TripCard";
import type { OrderGroup } from "./groups";
import type { BoardOrder, Trip } from "./types";

interface ReadySectionProps {
  title: string;
  groups: OrderGroup[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onMenu: (order: BoardOrder) => void;
}

/** Ready-to-dispatch orders for one fulfilment kind, one card per pincode or slot */
export function ReadySection({ title, groups, selected, onToggle, onMenu }: ReadySectionProps) {
  return (
    <>
      {groups.map((g) => (
        <SectionCard key={`${title}-${g.key}`} title={`${title} · ${g.label}`} flush>
          {g.orders.map((o) => (
            <DispatchRow key={o.id} order={o} selected={selected.has(o.id)} onToggle={() => onToggle(o.id)} onMenu={() => onMenu(o)} />
          ))}
        </SectionCard>
      ))}
    </>
  );
}

export function KitchenSection({ orders, onMenu }: { orders: BoardOrder[]; onMenu: (order: BoardOrder) => void }) {
  if (orders.length === 0) return null;
  return (
    <SectionCard title={`Preparing & pickups · ${orders.length}`} flush>
      {orders.map((o) => <DispatchRow key={o.id} order={o} onMenu={() => onMenu(o)} />)}
    </SectionCard>
  );
}

export function TripsSection({ title, trips, onChanged }: { title: string; trips: Trip[]; onChanged: () => void }) {
  if (trips.length === 0) return null;
  return (
    <>
      <Text style={styles.heading}>{title}</Text>
      {trips.map((t) => <TripCard key={t.id} trip={t} onChanged={onChanged} />)}
    </>
  );
}

const styles = StyleSheet.create({
  heading: { fontFamily: fonts.bold, fontSize: 11, color: manage.muted, letterSpacing: 0.9, textTransform: "uppercase", marginTop: 6 },
});
