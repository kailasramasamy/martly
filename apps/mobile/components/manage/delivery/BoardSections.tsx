import { Text, StyleSheet } from "react-native";
import { fonts } from "../../../constants/theme";
import { SectionCard } from "../ui/SectionCard";
import { manage } from "../ui/tokens";
import { DispatchRow } from "./DispatchRow";
import { TripCard } from "./TripCard";
import type { OrderGroup } from "./groups";
import type { BoardOrder, MenuOrder, Trip } from "./types";

interface ReadySectionProps {
  title: string;
  groups: OrderGroup[];
  selected: Set<string>;
  /** Absent for members who can't dispatch: rows then open the order menu instead of selecting */
  onToggle?: (id: string) => void;
  onMenu: (order: BoardOrder) => void;
}

/** Ready-to-dispatch orders for one fulfilment kind, one card per pincode or slot */
export function ReadySection({ title, groups, selected, onToggle, onMenu }: ReadySectionProps) {
  return (
    <>
      {groups.map((g) => (
        <SectionCard key={`${title}-${g.key}`} title={`${title} · ${g.label}`} flush>
          {g.orders.map((o) => (
            <DispatchRow key={o.id} order={o} selected={onToggle ? selected.has(o.id) : undefined} onToggle={onToggle && (() => onToggle(o.id))} onMenu={() => onMenu(o)} />
          ))}
        </SectionCard>
      ))}
    </>
  );
}

/** A plain list of orders under a heading, each opening the order menu */
export function OrdersSection({ title, orders, onMenu }: { title: string; orders: BoardOrder[]; onMenu: (order: BoardOrder) => void }) {
  if (orders.length === 0) return null;
  return (
    <SectionCard title={`${title} · ${orders.length}`} flush>
      {orders.map((o) => <DispatchRow key={o.id} order={o} onMenu={() => onMenu(o)} />)}
    </SectionCard>
  );
}

export function TripsSection({ title, trips, onChanged, onMenu }: { title: string; trips: Trip[]; onChanged: () => void; onMenu: (order: MenuOrder) => void }) {
  if (trips.length === 0) return null;
  return (
    <>
      <Text style={styles.heading}>{title}</Text>
      {trips.map((t) => <TripCard key={t.id} trip={t} onChanged={onChanged} onMenu={onMenu} />)}
    </>
  );
}

const styles = StyleSheet.create({
  heading: { fontFamily: fonts.bold, fontSize: 11, color: manage.muted, letterSpacing: 0.9, textTransform: "uppercase", marginTop: 6 },
});
