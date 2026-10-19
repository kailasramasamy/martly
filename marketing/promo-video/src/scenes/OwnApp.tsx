import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import {
  Calculator, Calendar, Camera, Clock, Cloud, Image, Leaf, Mail, Map, MessageCircle, Music, NotebookPen, Phone, Settings, ShoppingBasket, Video,
  type LucideIcon,
} from "lucide-react";
import { Backdrop } from "../components/Backdrop";
import { Caption } from "../components/Caption";
import { PhoneFrame } from "../components/PhoneFrame";
import { usePop } from "../components/usePop";
import { useCopy } from "../copy";
import { colors } from "../theme";

const ICON = 112;
const YOURS = 5;
const APPS: { Icon: LucideIcon; bg: string }[] = [
  { Icon: Calendar, bg: "#f1f5f9" }, { Icon: Image, bg: "#fb923c" }, { Icon: Camera, bg: "#64748b" }, { Icon: Mail, bg: "#3b82f6" },
  { Icon: Clock, bg: "#1e293b" }, { Icon: Map, bg: "#4ade80" }, { Icon: Music, bg: "#f43f5e" }, { Icon: Cloud, bg: "#38bdf8" },
  { Icon: NotebookPen, bg: "#facc15" }, { Icon: Calculator, bg: "#f97316" }, { Icon: Video, bg: "#6366f1" }, { Icon: Settings, bg: "#94a3b8" },
];
const DOCK: { Icon: LucideIcon; bg: string }[] = [{ Icon: Phone, bg: "#22c55e" }, { Icon: MessageCircle, bg: "#22c55e" }, { Icon: Camera, bg: "#64748b" }, { Icon: Music, bg: "#f43f5e" }];

const AppIcon = ({ Icon, bg }: { Icon: LucideIcon; bg: string }) => (
  <div style={{ width: ICON, height: ICON, borderRadius: 28, background: bg, opacity: 0.55, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <Icon size={56} color={bg === "#f1f5f9" || bg === "#facc15" ? "#0f172a" : "#ffffff"} strokeWidth={2} />
  </div>
);

const YourIcon = () => {
  const copy = useCopy();
  const frame = useCurrentFrame();
  const p = usePop(40, 8);
  const bob = frame > 70 ? Math.sin((frame - 70) / 5) * 6 : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, transform: `scale(${interpolate(p, [0, 1], [0, 1.3])}) translateY(${bob}px)`, zIndex: 1 }}>
      <div style={{ position: "relative", width: ICON, height: ICON, borderRadius: 28, background: `linear-gradient(145deg, ${colors.primaryLight}, ${colors.primaryDark})`, boxShadow: `0 0 0 4px ${colors.accent}, 0 16px 30px rgba(0,0,0,0.5)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <ShoppingBasket size={64} color={colors.surface} strokeWidth={2.2} />
        <Leaf size={34} color={colors.accent} fill={colors.accent} strokeWidth={1.5} style={{ position: "absolute", top: 12, right: 12 }} />
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: colors.surface, whiteSpace: "nowrap" }}>{copy.ownAppName}</div>
    </div>
  );
};

const HomeScreen = () => {
  const icons = [...APPS.slice(0, YOURS), null, ...APPS.slice(YOURS)];
  return (
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, #1e3a5f, #0f172a 70%)", padding: "150px 36px 0" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", rowGap: 54, justifyItems: "center" }}>
        {icons.map((app, i) => (app ? <AppIcon key={i} {...app} /> : <YourIcon key={i} />))}
      </div>
      <div style={{ position: "absolute", left: 24, right: 24, bottom: 40, padding: 22, borderRadius: 44, background: "rgba(255,255,255,0.12)", display: "flex", justifyContent: "space-around" }}>
        {DOCK.map((app, i) => (
          <AppIcon key={i} {...app} />
        ))}
      </div>
    </div>
  );
};

export const OwnApp = () => {
  const copy = useCopy();
  const tag = usePop(24, 200);
  return (
    <Backdrop tone="night">
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 170, gap: 36 }}>
        <Caption lines={copy.ownApp} size={88} stagger={10} />
        <div style={{ padding: "14px 30px", borderRadius: 999, border: `3px solid ${colors.accent}`, color: colors.accent, fontSize: 32, fontWeight: 800, opacity: tag }}>{copy.ownAppTag}</div>
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", top: 560 }}>
        <PhoneFrame>
          <HomeScreen />
        </PhoneFrame>
      </AbsoluteFill>
    </Backdrop>
  );
};
