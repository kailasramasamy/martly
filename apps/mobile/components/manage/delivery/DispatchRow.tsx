import { TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ListRow } from "../ui/ListRow";
import { StatusPill } from "../ui/StatusPill";
import { ORDER_STATUS, formatINR, manage } from "../ui/tokens";
import { timeAgo } from "../ui/dates";
import type { BoardOrder } from "./types";

interface DispatchRowProps {
  order: BoardOrder;
  selected?: boolean;
  /** Present on selectable (ready) rows: tapping toggles selection */
  onToggle?: () => void;
  onMenu: () => void;
}

export function DispatchRow({ order, selected, onToggle, onMenu }: DispatchRowProps) {
  const items = order.items.reduce((sum, i) => sum + i.quantity, 0);
  const status = ORDER_STATUS[order.status];
  const where = order.fulfillmentType === "PICKUP" ? "Pickup" : order.deliveryAddress ?? "No address";
  return (
    <ListRow
      title={`#${order.id.slice(0, 8)} · ${order.user.name}`}
      subtitle={where}
      caption={`${items} item${items === 1 ? "" : "s"} · ${timeAgo(order.createdAt)}`}
      value={formatINR(order.totalAmount)}
      railColor={status?.color}
      selected={selected}
      onPress={onToggle ?? onMenu}
      trailing={
        <>
          {status && <StatusPill {...status} />}
          <TouchableOpacity style={styles.menu} onPress={onMenu} hitSlop={6} accessibilityRole="button" accessibilityLabel="Order actions">
            <Ionicons name="ellipsis-horizontal" size={18} color={manage.muted} />
          </TouchableOpacity>
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  menu: { minWidth: 44, height: 28, alignItems: "flex-end", justifyContent: "center" },
});
