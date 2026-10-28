import type { ReactNode } from "react";
import { AbsoluteFill, Sequence, interpolate } from "remotion";
import type { Line } from "../copy";
import { Backdrop } from "./Backdrop";
import { Caption } from "./Caption";
import { PhoneFrame } from "./PhoneFrame";
import { usePop } from "./usePop";

export type CaptionSpan = { from: number; to?: number; lines: Line[] };

/** Caption block up top, phone rising in below — the layout every app-walkthrough scene shares */
export const PhoneScene = ({ tone = "teal", captions, children }: { tone?: "teal" | "night"; captions: CaptionSpan[]; children: ReactNode }) => {
  const p = usePop(0, 18);
  return (
    <Backdrop tone={tone}>
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 150 }}>
        {captions.map((c) => (
          <Sequence key={c.from} from={c.from} durationInFrames={c.to ? c.to - c.from : undefined} layout="none">
            <Caption lines={c.lines} size={92} />
          </Sequence>
        ))}
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", top: 470 }}>
        <PhoneFrame style={{ transform: `translateY(${interpolate(p, [0, 1], [600, 0])}px)` }}>{children}</PhoneFrame>
      </AbsoluteFill>
    </Backdrop>
  );
};
