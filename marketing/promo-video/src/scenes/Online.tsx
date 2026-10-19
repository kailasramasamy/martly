import { AbsoluteFill, Img, interpolate, staticFile } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { Caption } from "../components/Caption";
import { usePop } from "../components/usePop";
import { useCopy } from "../copy";
import { colors } from "../theme";

type Store = { name: string; tagline: string; yours?: boolean };

const StoreCard = ({ name, tagline, yours = false, index }: Store & { index: number }) => {
  const copy = useCopy();
  const p = usePop(yours ? 70 : 40 + index * 8, yours ? 11 : 18);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 30,
        width: 880,
        padding: "30px 36px",
        borderRadius: 36,
        background: colors.surface,
        border: `5px solid ${yours ? colors.accent : "transparent"}`,
        boxShadow: yours ? "0 30px 70px rgba(0,0,0,0.35)" : "none",
        opacity: yours ? Math.min(p, 1) : 0.75 * Math.min(p, 1),
        transform: yours ? `scale(${interpolate(p, [0, 1], [0.6, 1.04])})` : `translateY(${interpolate(p, [0, 1], [50, 0])}px)`,
      }}
    >
      <div style={{ width: 96, height: 96, borderRadius: 26, background: yours ? colors.primary : colors.border, color: colors.surface, fontSize: 44, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {name[0]}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 40, fontWeight: 800, color: colors.text }}>{name}</div>
        <div style={{ fontSize: 28, fontWeight: 600, color: colors.textSecondary }}>{tagline}</div>
      </div>
      {yours && (
        <div style={{ padding: "10px 20px", borderRadius: 999, background: colors.accent, color: colors.accentText, fontSize: 24, fontWeight: 800 }}>{copy.storeBadge}</div>
      )}
    </div>
  );
};

export const Online = () => {
  const copy = useCopy();
  const logo = usePop(4, 12);
  return (
    <Backdrop tone="teal">
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 220, gap: 90 }}>
        <Img src={staticFile("martly-wordmark-dark.svg")} style={{ width: 560, transform: `scale(${interpolate(logo, [0, 1], [0.6, 1])})`, opacity: Math.min(logo, 1) }} />
        <Caption lines={copy.online} delay={16} stagger={10} size={92} />
        <div style={{ display: "flex", flexDirection: "column", gap: 28, marginTop: 30 }}>
          {copy.onlineStores.map((store: Store, i) => (
            <StoreCard key={store.name} {...store} index={i} />
          ))}
        </div>
      </AbsoluteFill>
    </Backdrop>
  );
};
