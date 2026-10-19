import type { ReactNode } from "react";
import { Activity, BatteryFull, Bell, Bike, Box, Grip, ReceiptText, Signal, Wifi, type LucideIcon } from "lucide-react";
import { fontFamily } from "../theme";
import { manage } from "./tokens";

// Real screens are 393pt wide; the phone frame's screen is 604px
export const PT_W = 393;
export const PT_H = 852;
const SCALE = 604 / PT_W;

export const AppCanvas = ({ children, bg = manage.canvas }: { children: ReactNode; bg?: string }) => (
  <div style={{ position: "absolute", left: 0, top: 0, width: PT_W, height: PT_H, transform: `scale(${SCALE})`, transformOrigin: "0 0", background: bg, fontFamily, overflow: "hidden" }}>
    {children}
  </div>
);

export const StatusBar = ({ dark }: { dark?: boolean }) => {
  const c = dark ? "#ffffff" : "#000000";
  return (
    <div style={{ height: 54, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 34px 0 52px", color: c, fontSize: 17, fontWeight: 700 }}>
      <span>9:41</span>
      <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <Signal size={17} strokeWidth={3} />
        <Wifi size={17} strokeWidth={3} />
        <BatteryFull size={24} strokeWidth={2} />
      </span>
    </div>
  );
};

export const StorePill = ({ chevron }: { chevron?: boolean }) => (
  <div style={{ height: 34, padding: "0 12px", borderRadius: 17, background: manage.inkRaised, display: "inline-flex", alignItems: "center", gap: 8, color: manage.inkText, fontSize: 13, fontWeight: 700 }}>
    <span style={{ width: 7, height: 7, borderRadius: 4, background: manage.live }} />
    Harur Fresh Mart{chevron ? "  ⌄" : ""}
  </div>
);

export const BellIcon = ({ count }: { count: number }) => (
  <div style={{ position: "relative", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
    <Bell size={22} />
    <span style={{ position: "absolute", top: 4, right: 2, minWidth: 16, height: 16, padding: "0 3px", borderRadius: 8, background: "#ef4444", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{count}</span>
  </div>
);

export const ManageHeader = ({ title, subtitle }: { title: string; subtitle?: ReactNode }) => (
  <div style={{ background: manage.ink, padding: "0 16px 14px" }}>
    <StatusBar dark />
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
      <StorePill />
      <BellIcon count={13} />
    </div>
    <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: -0.6, marginTop: 6 }}>{title}</div>
    {subtitle && <div style={{ fontSize: 13.5, fontWeight: 600, color: "#fff", marginTop: 4 }}>{subtitle}</div>}
  </div>
);

const TABS: { label: string; Icon: LucideIcon }[] = [
  { label: "Today", Icon: Activity },
  { label: "Orders", Icon: ReceiptText },
  { label: "Inventory", Icon: Box },
  { label: "Delivery", Icon: Bike },
  { label: "More", Icon: Grip },
];

export const ManageTabBar = ({ active }: { active: string }) => (
  <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 96, background: "#fff", borderTop: `1px solid ${manage.line}`, display: "flex", justifyContent: "space-around", paddingTop: 8 }}>
    {TABS.map(({ label, Icon }) => {
      const on = label === active;
      return (
        <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: 70 }}>
          <div style={{ width: 60, height: 32, borderRadius: 16, background: on ? manage.tealSoft : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon size={22} color={on ? manage.teal : "#94a3b8"} strokeWidth={1.8} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: on ? manage.teal : "#94a3b8" }}>{label}</span>
        </div>
      );
    })}
  </div>
);

export const StackHeader = ({ title }: { title: string }) => (
  <div style={{ background: "#fff", borderBottom: `1px solid ${manage.line}` }}>
    <StatusBar />
    <div style={{ height: 60, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 600, color: manage.text }}>
      <span style={{ position: "absolute", left: 16, padding: "8px 14px", borderRadius: 22, background: "#f8fafc", fontSize: 16, fontWeight: 500, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>‹ Back</span>
      {title}
    </div>
  </div>
);
