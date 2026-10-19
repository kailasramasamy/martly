import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Line } from "../copy";
import { useCopy } from "../copy";
import { colors } from "../theme";

type Props = {
  lines: Line[];
  delay?: number;
  stagger?: number;
  size?: number;
  dark?: boolean;
  align?: "left" | "center";
};

export const Caption = ({ lines, delay = 0, stagger = 6, size = 92, dark = true, align = "center" }: Props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { font, captionScale, captionTracking } = useCopy();
  const base = dark ? colors.surface : colors.text;

  return (
    <div style={{ fontFamily: font, textAlign: align, lineHeight: 1.12, letterSpacing: captionTracking, maxWidth: 960 }}>
      {lines.map((line, i) => {
        const p = spring({ frame: frame - delay - i * stagger, fps, config: { damping: 200 } });
        return (
          <div key={line.text} style={{ overflow: "hidden", paddingBottom: 8 }}>
            <div
              style={{
                fontSize: size * captionScale,
                fontWeight: 800,
                color: line.highlight ? colors.accent : base,
                transform: `translateY(${interpolate(p, [0, 1], [110, 0])}%)`,
                opacity: p,
              }}
            >
              {line.text}
            </div>
          </div>
        );
      })}
    </div>
  );
};
