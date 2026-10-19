import { AbsoluteFill, Img, interpolate, staticFile } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { Caption } from "../components/Caption";
import { usePop } from "../components/usePop";
import { useCopy } from "../copy";
import { colors } from "../theme";

export const Cta = () => {
  const copy = useCopy();
  const logo = usePop(0, 14);
  const qr = usePop(36, 14);
  const contact = usePop(50, 200);
  return (
    <Backdrop tone="teal">
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 230, gap: 90 }}>
        <Img src={staticFile("martly-wordmark-dark.svg")} style={{ width: 520, transform: `scale(${logo})` }} />
        <Caption lines={copy.cta} size={100} delay={10} stagger={10} />
        <div style={{ padding: 32, borderRadius: 40, background: colors.surface, transform: `scale(${qr})` }}>
          <Img src={staticFile("qr.svg")} style={{ width: 340, height: 340, display: "block" }} />
        </div>
        <div style={{ textAlign: "center", color: colors.surface, opacity: contact, transform: `translateY(${interpolate(contact, [0, 1], [40, 0])}px)` }}>
          <div style={{ fontSize: 64, fontWeight: 800 }}>{copy.ctaContact}</div>
          <div style={{ fontSize: 40, fontWeight: 600, opacity: 0.85, marginTop: 10 }}>{copy.ctaSite}</div>
          <div style={{ fontSize: 38, fontWeight: 700, color: colors.accent, marginTop: 40 }}>{copy.ctaFooter}</div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 50 }}>
        <div style={{ fontSize: 22, fontWeight: 500, color: colors.surface, opacity: 0.55 }}>{copy.musicCredit}</div>
      </AbsoluteFill>
    </Backdrop>
  );
};
