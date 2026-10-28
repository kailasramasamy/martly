import { AbsoluteFill, Img, interpolate, staticFile } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { Caption } from "../components/Caption";
import { usePop } from "../components/usePop";
import { useCopy } from "../copy";
import { colors } from "../theme";

const STORES = [
  { name: "Sree Ranga Store", packs: ["packs/sr-toor.webp", "packs/sr-ponni.webp"] },
  { name: "PSB Store", packs: ["packs/psb-toor.webp", "packs/psb-ponni.webp"] },
];
const PACK_W = 300;

const Pack = ({ src, delay, tilt }: { src: string; delay: number; tilt: number }) => {
  const p = usePop(delay, 12);
  return (
    <Img
      src={staticFile(src)}
      style={{ width: PACK_W, transform: `translateY(${interpolate(p, [0, 1], [500, 0])}px) rotate(${tilt * p}deg)`, filter: "drop-shadow(0 30px 40px rgba(0,0,0,0.35))" }}
    />
  );
};

const StoreRow = ({ name, packs, index }: (typeof STORES)[number] & { index: number }) => {
  const label = usePop(30 + index * 22, 200);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      <div style={{ display: "flex", gap: 24 }}>
        {packs.map((src, i) => (
          <Pack key={src} src={src} delay={14 + index * 22 + i * 8} tilt={i ? 4 : -4} />
        ))}
      </div>
      <div style={{ opacity: label, padding: "10px 30px", borderRadius: 999, background: index ? colors.accent : colors.surface, color: index ? colors.accentText : colors.primary, fontSize: 36, fontWeight: 800 }}>
        {name}
      </div>
    </div>
  );
};

export const Packs = () => {
  const copy = useCopy();
  return (
    <Backdrop tone="teal">
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 170 }}>
        <Caption lines={copy.packs} size={92} stagger={10} />
      </AbsoluteFill>
      <AbsoluteFill style={{ top: 520, alignItems: "center", gap: 40 }}>
        {STORES.map((store, i) => (
          <StoreRow key={store.name} {...store} index={i} />
        ))}
      </AbsoluteFill>
    </Backdrop>
  );
};
