import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { PromoScreen } from "../app-ui/PromoScreen";
import { Backdrop } from "../components/Backdrop";
import { Caption } from "../components/Caption";
import { PhoneFrame } from "../components/PhoneFrame";
import { usePop } from "../components/usePop";
import { useCopy } from "../copy";
import { colors } from "../theme";

const TYPE_FROM = 18;
const TYPE_FRAMES = 34;
const SUBMIT_AT = 62;
const DONE_AT = 96;
const BANNERS_AT = DONE_AT + 10;
const PUSH_AT = BANNERS_AT + 46;

const Phone = () => {
  const copy = useCopy();
  const frame = useCurrentFrame();
  const enter = usePop(0, 18);
  const exit = interpolate(frame, [DONE_AT + 4, BANNERS_AT + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <PhoneFrame style={{ transform: `translateY(${interpolate(enter, [0, 1], [600, 0]) + exit * 900}px) scale(${1 - exit * 0.2})`, opacity: 1 - exit }}>
      <PromoScreen brief={copy.promoBrief} typeFrom={TYPE_FROM} typeFrames={TYPE_FRAMES} submitAt={SUBMIT_AT} doneAt={DONE_AT} />
    </PhoneFrame>
  );
};

const Banner = ({ src, delay }: { src: string; delay: number }) => {
  const p = usePop(delay, 13);
  return (
    <Img src={staticFile(src)} style={{ width: 900, borderRadius: 32, boxShadow: "0 30px 60px rgba(0,0,0,0.35)", transform: `scale(${interpolate(p, [0, 1], [0.7, 1])})`, opacity: Math.min(p, 1) }} />
  );
};

const Push = () => {
  const copy = useCopy();
  const p = usePop(PUSH_AT, 14);
  return (
    <div style={{ position: "absolute", top: 36, left: 70, right: 70, display: "flex", gap: 24, alignItems: "center", padding: "26px 30px", borderRadius: 36, background: "rgba(255,255,255,0.97)", boxShadow: "0 20px 50px rgba(0,0,0,0.35)", transform: `translateY(${interpolate(p, [0, 1], [-300, 0])}px)` }}>
      <Img src={staticFile("martly-app-icon-ios.png")} style={{ width: 84, height: 84, borderRadius: 22 }} />
      <div>
        <div style={{ fontSize: 30, fontWeight: 800, color: colors.text }}>{copy.promoPush.title}</div>
        <div style={{ fontSize: 26, fontWeight: 600, color: colors.textSecondary }}>{copy.promoPush.body}</div>
      </div>
    </div>
  );
};

export const Promos = () => {
  const copy = useCopy();
  const frame = useCurrentFrame();
  return (
    <Backdrop tone="teal">
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 230 }}>
        <Caption lines={copy.promos} size={84} stagger={10} />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", top: 520 }}>
        {frame < BANNERS_AT + 8 && <Phone />}
      </AbsoluteFill>
      {frame >= BANNERS_AT && (
        <AbsoluteFill style={{ alignItems: "center", top: 600, gap: 36 }}>
          <Banner src={copy.promoBanners[0]} delay={BANNERS_AT} />
          <Banner src={copy.promoBanners[1]} delay={BANNERS_AT + 12} />
        </AbsoluteFill>
      )}
      {frame >= PUSH_AT && <Push />}
    </Backdrop>
  );
};
