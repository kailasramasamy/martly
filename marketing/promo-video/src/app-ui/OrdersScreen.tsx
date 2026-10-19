import { interpolate } from "remotion";
import { Bike, ChevronRight, Search, ShoppingBag } from "lucide-react";
import { usePop } from "../components/usePop";
import { AppCanvas, ManageHeader, ManageTabBar } from "./Canvas";
import { manage, ORDER_STATUS, type OrderStatus } from "./tokens";

type Order = { id: string; name: string; items: number; delivery: boolean; status: OrderStatus; ago: string; total: number; paid: boolean };

const ORDERS: Order[] = [
  { id: "a41c09e2", name: "Priya S.", items: 6, delivery: true, status: "NEW", ago: "just now", total: 486, paid: true },
  { id: "7be3d510", name: "Karthik M.", items: 3, delivery: true, status: "NEW", ago: "2m ago", total: 153, paid: false },
  { id: "c2f98a7d", name: "Meena R.", items: 11, delivery: true, status: "CONFIRMED", ago: "6m ago", total: 1240, paid: true },
  { id: "18d4be63", name: "Arun K.", items: 4, delivery: false, status: "PREPARING", ago: "9m ago", total: 312, paid: true },
  { id: "e90a27c4", name: "Divya P.", items: 8, delivery: true, status: "READY", ago: "14m ago", total: 795, paid: true },
  { id: "5f6c13ab", name: "Suresh B.", items: 2, delivery: true, status: "OUT", ago: "21m ago", total: 118, paid: false },
  { id: "93ad7e20", name: "Lakshmi N.", items: 5, delivery: true, status: "OUT", ago: "26m ago", total: 642, paid: true },
];

const CHIPS = [
  { label: "Active", n: 26, on: true },
  { label: "New", n: 7 },
  { label: "Confirmed", n: 5 },
  { label: "Preparing", n: 4 },
];

const Row = ({ order, index }: { order: Order; index: number }) => {
  const p = usePop(8 + index * 5, 16);
  const s = ORDER_STATUS[order.status];
  const Icon = order.delivery ? Bike : ShoppingBag;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, height: 80, padding: "0 14px 0 16px", background: "#fff", borderBottom: `1px solid ${manage.line}`, borderLeft: `4px solid ${s.color}`, opacity: Math.min(p, 1), transform: `translateX(${interpolate(p, [0, 1], [80, 0])}px)` }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${s.color}1f`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={18} color={s.color} strokeWidth={1.8} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15.5, fontWeight: 700, color: manage.text }}>#{order.id} · {order.name}</div>
        <div style={{ fontSize: 13.5, color: manage.textSecondary, marginTop: 2 }}>{order.items} items · {order.delivery ? "Delivery" : "Pickup"}</div>
        <div style={{ fontSize: 13, marginTop: 2 }}>
          <span style={{ fontWeight: 700, color: s.color }}>{s.label}</span>
          <span style={{ color: "#94a3b8" }}> · {order.ago}</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
        <span style={{ fontSize: 15.5, fontWeight: 800, color: manage.text }}>{"₹"}{order.total.toLocaleString("en-IN")}</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 10, background: order.paid ? "#dcfce7" : "#fef3c7", color: order.paid ? "#15803d" : "#b45309" }}>{order.paid ? "Paid" : "COD"}</span>
      </div>
      <ChevronRight size={18} color="#94a3b8" />
    </div>
  );
};

const Toolbar = () => (
  <div style={{ padding: "12px 12px 14px" }}>
    <div style={{ height: 44, borderRadius: 14, background: "#fff", border: `1px solid ${manage.line}`, display: "flex", alignItems: "center", gap: 10, padding: "0 14px", color: "#94a3b8", fontSize: 15 }}>
      <Search size={18} /> Search order ID or customer
    </div>
    <div style={{ display: "flex", gap: 8, marginTop: 12, overflow: "hidden" }}>
      {CHIPS.map((c) => (
        <div key={c.label} style={{ flexShrink: 0, height: 36, padding: "0 6px 0 14px", borderRadius: 18, display: "flex", alignItems: "center", gap: 8, fontSize: 14.5, fontWeight: 600, background: c.on ? manage.text : "#fff", color: c.on ? "#fff" : manage.text, border: `1px solid ${c.on ? manage.text : manage.line}` }}>
          {c.label}
          <span style={{ minWidth: 24, height: 24, borderRadius: 12, background: c.on ? manage.attention : manage.attentionBg, color: manage.attentionText, fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{c.n}</span>
        </div>
      ))}
    </div>
  </div>
);

export const OrdersScreen = () => (
  <AppCanvas>
    <ManageHeader title="Orders" />
    <Toolbar />
    {ORDERS.map((order, i) => (
      <Row key={order.id} order={order} index={i} />
    ))}
    <ManageTabBar active="Orders" />
  </AppCanvas>
);
