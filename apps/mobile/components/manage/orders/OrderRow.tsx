import { memo } from "react";
import { ListRow } from "../ui/ListRow";
import { StatusPill } from "../ui/StatusPill";
import { ORDER_STATUS, PAYMENT_STATUS, formatINR } from "../ui/tokens";
import { timeAgo } from "../ui/dates";
import { SwipeToAdvance } from "./SwipeToAdvance";
import { useAuth } from "../../../lib/auth-context";
import { actionColor, actionLabel, forwardStatus } from "./order-flow";
import type { OrderListItem } from "./types";

interface OrderRowProps {
  order: OrderListItem;
  /** undefined outside selection mode; otherwise whether this row is ticked */
  selected: boolean | undefined;
  onOpen: (order: OrderListItem) => void;
  onSelect: (order: OrderListItem) => void;
  onAdvance: (order: OrderListItem, status: string) => void;
}

function OrderRowBase({ order, selected, onOpen, onSelect, onAdvance }: OrderRowProps) {
  const { user } = useAuth();
  const next = forwardStatus(order, user);
  const selecting = selected !== undefined;
  const payment = order.paymentMethod === "COD" && order.paymentStatus === "PENDING"
    ? { label: "COD", color: "#b45309", bg: "#fef3c7" }
    : PAYMENT_STATUS[order.paymentStatus] ?? PAYMENT_STATUS.PENDING;
  const count = order.items.length;

  return (
    <SwipeToAdvance
      disabled={!next || selecting}
      label={next ? actionLabel(next, order.fulfillmentType) : undefined}
      color={next ? actionColor(next) : undefined}
      onAdvance={() => next && onAdvance(order, next)}
    >
      <ListRow
        title={`#${order.id.slice(0, 8)} · ${order.user.name || order.user.email}`}
        subtitle={`${count} item${count === 1 ? "" : "s"} · ${order.fulfillmentType === "PICKUP" ? "Pickup" : "Delivery"}`}
        caption={timeAgo(order.createdAt)}
        status={ORDER_STATUS[order.status]}
        icon={order.fulfillmentType === "PICKUP" ? "bag-handle-outline" : "bicycle-outline"}
        value={formatINR(Number(order.totalAmount))}
        trailing={<StatusPill {...payment} />}
        railColor={ORDER_STATUS[order.status]?.color}
        selected={selected}
        onPress={() => (selecting ? onSelect(order) : onOpen(order))}
        onLongPress={() => onSelect(order)}
        chevron={!selecting}
      />
    </SwipeToAdvance>
  );
}

export const OrderRow = memo(OrderRowBase);
