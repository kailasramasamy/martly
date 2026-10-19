import { AbsoluteFill, Img, interpolate, staticFile } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { Caption } from "../components/Caption";
import { usePop } from "../components/usePop";
import { useCopy } from "../copy";
import { colors } from "../theme";

// Frame 0 doubles as the WhatsApp preview, so the headline and first notifications are already in place
const SETTLED = -40;
const NOTIFICATION_AT = [SETTLED, SETTLED, 18];

const Notification = ({ text, index }: { text: string; index: number }) => {
  const copy = useCopy();
  const p = usePop(NOTIFICATION_AT[index]);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 28,
        width: 860,
        padding: "32px 36px",
        borderRadius: 36,
        background: "rgba(255,255,255,0.1)",
        border: "2px solid rgba(255,255,255,0.14)",
        transform: `translateY(${interpolate(p, [0, 1], [-60, 0])}px) scale(${interpolate(p, [0, 1], [0.9, 1])})`,
        opacity: Math.min(p, 1),
      }}
    >
      <div style={{ width: 84, height: 84, borderRadius: 22, background: "#475569", flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 28, color: "#94a3b8", fontWeight: 600 }}>{copy.hookSource}</div>
        <div style={{ fontSize: 38, color: colors.surface, fontWeight: 700 }}>{text}</div>
      </div>
    </div>
  );
};

export const Hook = () => {
  const copy = useCopy();
  return (
    <Backdrop tone="night">
      <AbsoluteFill style={{ padding: "260px 90px 0" }}>
        <Caption lines={copy.hook} delay={SETTLED} align="left" size={92} />
      </AbsoluteFill>
      <AbsoluteFill style={{ top: 860, alignItems: "center", gap: 26 }}>
        {copy.hookNotifications.map((t, i) => (
          <Notification key={t} text={t} index={i} />
        ))}
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 230 }}>
        <Img src={staticFile("martly-wordmark-dark.svg")} style={{ width: 300, opacity: 0.9 }} />
      </AbsoluteFill>
    </Backdrop>
  );
};
