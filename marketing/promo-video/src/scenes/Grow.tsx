import { AbsoluteFill, interpolate } from "remotion";
import { CalendarSync, Star, TicketPercent, Wallet, type LucideIcon } from "lucide-react";
import { Backdrop } from "../components/Backdrop";
import { Caption } from "../components/Caption";
import { usePop } from "../components/usePop";
import { useCopy, type Copy } from "../copy";
import { colors } from "../theme";

const TILE_STYLE: { Icon: LucideIcon; accent?: boolean }[] = [
  { Icon: TicketPercent, accent: true },
  { Icon: Star },
  { Icon: Wallet },
  { Icon: CalendarSync, accent: true },
];

const Tile = ({ tile, index }: { tile: Copy["growTiles"][number] & (typeof TILE_STYLE)[number]; index: number }) => {
  const p = usePop(28 + index * 10, 11);
  return (
    <div
      style={{
        height: 380,
        borderRadius: 40,
        padding: 40,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: tile.accent ? colors.accent : colors.surface,
        color: tile.accent ? colors.accentText : colors.text,
        transform: `scale(${interpolate(p, [0, 1], [0.4, 1])}) rotate(${interpolate(p, [0, 1], [index % 2 ? 8 : -8, 0])}deg)`,
        opacity: Math.min(p, 1),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ width: 76, height: 76, borderRadius: 22, display: "flex", alignItems: "center", justifyContent: "center", background: tile.accent ? "rgba(69,26,3,0.12)" : "#f0fdfa" }}>
          <tile.Icon size={44} color={tile.accent ? colors.accentText : colors.primary} strokeWidth={2.2} />
        </div>
        <div style={{ fontSize: 32, fontWeight: 700, opacity: 0.75 }}>{tile.label}</div>
      </div>
      <div>
        <div style={{ fontSize: 60, fontWeight: 800, letterSpacing: -1 }}>{tile.value}</div>
        <div style={{ fontSize: 28, fontWeight: 600, opacity: 0.7, marginTop: 8 }}>{tile.note}</div>
      </div>
    </div>
  );
};

export const Grow = () => {
  const copy = useCopy();
  return (
    <Backdrop tone="teal">
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 220 }}>
        <Caption lines={copy.grow} size={88} stagger={10} />
      </AbsoluteFill>
      <AbsoluteFill style={{ top: 720, padding: "0 70px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
          {copy.growTiles.map((tile, i) => (
            <Tile key={tile.label} tile={{ ...tile, ...TILE_STYLE[i] }} index={i} />
          ))}
        </div>
      </AbsoluteFill>
    </Backdrop>
  );
};
