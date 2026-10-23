import { MobileOutlined } from "@ant-design/icons";
import type { AdProductKind } from "@martly/shared/constants";
import { PHONE_HEIGHT, PHONE_WIDTH, PhoneFrame } from "./PhoneFrame";
import { previewFor } from "./placement-previews";

interface Props { kind: AdProductKind; placement: string | null; width: number }

/** First mockup of a placement as a small phone: the full-size phone scaled from its top-left corner inside a clipped box of the scaled size */
export function MockupThumb({ kind, placement, width }: Props) {
  const Mockup = previewFor(kind, placement)?.mockups[0]?.render;
  const scale = width / PHONE_WIDTH;
  const height = Math.round(PHONE_HEIGHT * scale);
  if (!Mockup) {
    return (
      <div style={{ width, height: Math.min(height, width), display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: "#f0fdfa", color: "#0f766e", fontSize: Math.round(width / 2.5) }}>
        <MobileOutlined />
      </div>
    );
  }
  return (
    <div aria-hidden style={{ width, height, overflow: "hidden", pointerEvents: "none", flexShrink: 0 }}>
      <div style={{ width: PHONE_WIDTH, height: PHONE_HEIGHT, transformOrigin: "top left", transform: `scale(${scale})` }}>
        <PhoneFrame><Mockup /></PhoneFrame>
      </div>
    </div>
  );
}
