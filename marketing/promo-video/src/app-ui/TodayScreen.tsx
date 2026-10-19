import { interpolate, useCurrentFrame } from "remotion";
import { AppCanvas, ManageHeader, ManageTabBar } from "./Canvas";
import { manage } from "./tokens";

const KPIS = [
  { label: "Today’s revenue", value: 48620, money: true, trend: "18%", bars: [3, 4, 4, 5, 6, 7, 9] },
  { label: "Today’s orders", value: 186, trend: "12%", bars: [4, 4, 5, 5, 6, 7, 8] },
  { label: "Avg order value · 7d", value: 261, money: true },
  { label: "Customers · 7d", value: 1240 },
];
const QUEUE = [
  { n: 7, label: "New", dot: "#b45309", attention: true },
  { n: 5, label: "Confirmed", dot: "#1d4ed8" },
  { n: 4, label: "Preparing", dot: "#0e7490" },
  { n: 6, label: "Ready", dot: "#4338ca" },
];
const WEEK = [31, 36, 34, 40, 43, 45, 49];

const useCount = (to: number, delay = 0) => {
  const frame = useCurrentFrame();
  return Math.round(interpolate(frame, [delay, delay + 40], [0, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
};

const fmt = (n: number, money?: boolean) => `${money ? "₹" : ""}${n.toLocaleString("en-IN")}`;

const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: manage.card, border: `1px solid ${manage.line}`, borderRadius: 12, padding: "14px 13px", ...style }}>{children}</div>
);

const Kpi = ({ kpi }: { kpi: (typeof KPIS)[number] }) => {
  const value = useCount(kpi.value, 6);
  return (
    <Card style={{ flex: 1, height: 103 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: manage.textSecondary }}>{kpi.label}</div>
      <div style={{ fontSize: 23, fontWeight: 800, color: manage.text, marginTop: 8, letterSpacing: -0.4 }}>{fmt(value, kpi.money)}</div>
      {kpi.trend && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 6 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: manage.up }}>↑ {kpi.trend}</span>
          <span style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 18 }}>
            {kpi.bars.map((h, i) => (
              <span key={i} style={{ width: 5, height: h * 2, borderRadius: 1.5, background: i === kpi.bars.length - 1 ? manage.teal : "#bcd9d6" }} />
            ))}
          </span>
        </div>
      )}
    </Card>
  );
};

const LiveQueue = () => (
  <Card>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 1.2, color: manage.textSecondary }}>LIVE QUEUE</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: manage.teal }}>All orders</span>
    </div>
    <div style={{ display: "flex", gap: 8 }}>
      {QUEUE.map((q) => (
        <div key={q.label} style={{ flex: 1, minHeight: 64, borderRadius: 8, border: `1px solid ${q.attention ? manage.attention : manage.line}`, background: q.attention ? manage.attentionBg : manage.card, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: q.attention ? manage.attentionText : manage.text }}>{q.n}</span>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: manage.textSecondary, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: q.dot }} />
            {q.label}
          </span>
        </div>
      ))}
    </div>
  </Card>
);

const WeekChart = () => {
  const frame = useCurrentFrame();
  const grow = interpolate(frame, [20, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Card>
      <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 1.2, color: manage.textSecondary }}>REVENUE · LAST 7 DAYS</div>
      <div style={{ marginTop: 8, fontSize: 21, fontWeight: 800, color: manage.text }}>
        {fmt(useCount(48620, 6), true)} <span style={{ fontSize: 13, fontWeight: 500, color: manage.textSecondary }}>Today</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120, marginTop: 12 }}>
        {WEEK.map((v, i) => (
          <div key={i} style={{ flex: 1, height: v * 2.4 * grow, borderRadius: 4, background: i === WEEK.length - 1 ? manage.teal : "#7ed8ce" }} />
        ))}
      </div>
    </Card>
  );
};

export const TodayScreen = () => (
  <AppCanvas>
    <ManageHeader title="Today" subtitle={<>Good morning, Ravi <span style={{ color: manage.inkMuted }}>· Mon, 19 Oct</span></>} />
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 10 }}>
        <Kpi kpi={KPIS[0]} />
        <Kpi kpi={KPIS[1]} />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Kpi kpi={KPIS[2]} />
        <Kpi kpi={KPIS[3]} />
      </div>
      <LiveQueue />
      <WeekChart />
    </div>
    <ManageTabBar active="Today" />
  </AppCanvas>
);
