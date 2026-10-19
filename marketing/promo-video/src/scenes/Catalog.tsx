import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { Caption } from "../components/Caption";
import { usePop } from "../components/usePop";
import { useCopy } from "../copy";
import { products } from "../products";
import { colors } from "../theme";

const TILE = 210;
const GAP = 24;

const Counter = () => {
  const copy = useCopy();
  const frame = useCurrentFrame();
  const value = Math.round(interpolate(frame, [20, 75], [0, copy.catalogCount], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return (
    <div style={{ textAlign: "center", color: colors.surface }}>
      <div style={{ fontSize: 170, fontWeight: 800, color: colors.accent, letterSpacing: -5, lineHeight: 1 }}>{value.toLocaleString("en-IN")}</div>
      <div style={{ fontSize: 42, fontWeight: 600, opacity: 0.9 }}>{copy.catalogCountLabel}</div>
    </div>
  );
};

const Marquee = ({ reverse }: { reverse?: boolean }) => {
  const frame = useCurrentFrame();
  const span = products.length * (TILE + GAP);
  const shift = ((frame * 6) % span) * (reverse ? 1 : -1) - (reverse ? span : 0);
  return (
    <div style={{ display: "flex", gap: GAP, transform: `translateX(${shift}px)` }}>
      {[...products, ...products, ...products].map((p, i) => (
        <div key={i} style={{ width: TILE, height: TILE, flexShrink: 0, borderRadius: 32, background: colors.surface, padding: 18 }}>
          <Img src={staticFile(p.image)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
      ))}
    </div>
  );
};

const Step = ({ label, index }: { label: string; index: number }) => {
  const p = usePop(90 + index * 10, 12);
  return (
    <div style={{ padding: "18px 36px", borderRadius: 999, background: index === 2 ? colors.accent : colors.surface, color: index === 2 ? colors.accentText : colors.primary, fontSize: 40, fontWeight: 800, transform: `scale(${p})` }}>
      {label}
    </div>
  );
};

export const Catalog = () => {
  const copy = useCopy();
  return (
    <Backdrop tone="teal">
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 190, gap: 70 }}>
        <Caption lines={copy.catalog} size={96} stagger={10} />
        <Counter />
      </AbsoluteFill>
      <AbsoluteFill style={{ top: 1000, gap: GAP, overflow: "hidden" }}>
        <Marquee />
        <Marquee reverse />
      </AbsoluteFill>
      <AbsoluteFill style={{ top: 1560, flexDirection: "row", justifyContent: "center", alignItems: "flex-start", gap: 20 }}>
        {copy.catalogSteps.map((s, i) => (
          <Step key={s} label={s} index={i} />
        ))}
      </AbsoluteFill>
    </Backdrop>
  );
};
