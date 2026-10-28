import { AbsoluteFill, interpolate } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { Caption } from "../components/Caption";
import { PhoneFrame } from "../components/PhoneFrame";
import { Screenshot } from "../components/ScreenFlow";
import { usePop } from "../components/usePop";
import { useCopy } from "../copy";
import { colors } from "../theme";

const PHONES = [
  { src: "screens/v2/11-shop-home.png", label: "English", tilt: -5 },
  { src: "screens/v2/19-shop-home-tamil.png", label: "தமிழ்", tilt: 5 },
];

const Phone = ({ src, label, tilt, index }: (typeof PHONES)[number] & { index: number }) => {
  const p = usePop(10 + index * 10, 14);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 36, transform: `translateY(${interpolate(p, [0, 1], [700, 0])}px) rotate(${tilt * p}deg)` }}>
      <div style={{ position: "relative", width: 640 * 0.72, height: 1345 * 0.72 }}>
        <PhoneFrame style={{ position: "absolute", top: 0, left: 0, transform: "scale(0.72)", transformOrigin: "0 0" }}>
          <Screenshot src={src} />
        </PhoneFrame>
      </div>
      <div style={{ padding: "12px 34px", borderRadius: 999, background: index ? colors.accent : colors.surface, color: index ? colors.accentText : colors.primary, fontSize: 40, fontWeight: 800 }}>{label}</div>
    </div>
  );
};

export const Language = () => {
  const copy = useCopy();
  return (
    <Backdrop tone="teal">
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 170 }}>
        <Caption lines={copy.language} size={88} stagger={10} />
      </AbsoluteFill>
      <AbsoluteFill style={{ top: 520, flexDirection: "row", justifyContent: "center", gap: 30 }}>
        {PHONES.map((phone, i) => (
          <Phone key={phone.label} {...phone} index={i} />
        ))}
      </AbsoluteFill>
    </Backdrop>
  );
};
