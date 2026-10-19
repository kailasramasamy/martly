import type { ReactNode } from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";

// Screenshot coordinates are measured on a 923px-wide preview; the phone screen is 604px wide
const PREVIEW_TO_SCREEN = 604 / 923;
const SLIDE = 8;

export type Step = { at: number; screen: string | ReactNode; tap?: { x: number; y: number; at: number } };

export const Screenshot = ({ src }: { src: string }) => (
  <Img src={staticFile(src)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
);

const Tap = ({ x, y, at }: { x: number; y: number; at: number }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [at - 8, at, at + 8], [0, 1, 2], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (t === 0 || t === 2) return null;
  const size = 64;
  return (
    <div
      style={{
        position: "absolute",
        left: x * PREVIEW_TO_SCREEN - size / 2,
        top: y * PREVIEW_TO_SCREEN - size / 2,
        width: size,
        height: size,
        borderRadius: size / 2,
        background: "rgba(15,118,110,0.35)",
        border: "4px solid rgba(255,255,255,0.9)",
        transform: `scale(${t < 1 ? 1.4 - t * 0.4 : 1 + (t - 1) * 0.6})`,
        opacity: t < 1 ? t : 2 - t,
      }}
    />
  );
};

const Slide = ({ step, next }: { step: Step; next?: Step }) => {
  const frame = useCurrentFrame();
  if (frame < step.at - SLIDE || (next && frame > next.at)) return null;
  const enter = interpolate(frame, [step.at - SLIDE, step.at], [100, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const leave = next ? interpolate(frame, [next.at - SLIDE, next.at], [0, -30], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  return (
    <AbsoluteFill style={{ transform: `translateX(${step.at === 0 ? leave : enter + leave}%)` }}>
      {typeof step.screen === "string" ? <Screenshot src={step.screen} /> : step.screen}
      {step.tap && <Tap {...step.tap} />}
    </AbsoluteFill>
  );
};

export const ScreenFlow = ({ steps }: { steps: Step[] }) => (
  <AbsoluteFill>
    {steps.map((step, i) => (
      <Slide key={i} step={step} next={steps[i + 1]} />
    ))}
  </AbsoluteFill>
);
