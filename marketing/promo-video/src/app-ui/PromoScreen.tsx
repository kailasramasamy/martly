import { interpolate, useCurrentFrame } from "remotion";
import { Sparkles } from "lucide-react";
import { AppCanvas, StackHeader } from "./Canvas";
import { BottomButton, FormCard, Label, Toggle } from "./Form";
import { manage } from "./tokens";

type Props = { brief: string; typeFrom: number; typeFrames: number; submitAt: number; doneAt: number };

const Option = ({ title, hint, on }: { title: string; hint: string; on: boolean }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
    <div>
      <div style={{ fontSize: 16, fontWeight: 500, color: manage.text }}>{title}</div>
      <div style={{ fontSize: 13.5, color: manage.textSecondary, marginTop: 2 }}>{hint}</div>
    </div>
    <Toggle on={on} />
  </div>
);

const SubmitLabel = ({ submitAt, doneAt }: { submitAt: number; doneAt: number }) => {
  const frame = useCurrentFrame();
  if (frame < submitAt) return <><Sparkles size={18} /> Create promo</>;
  if (frame < doneAt) return <>Designing your ad…</>;
  return <>Ready to launch ✓</>;
};

export const PromoScreen = ({ brief, typeFrom, typeFrames, submitAt, doneAt }: Props) => {
  const frame = useCurrentFrame();
  const chars = Math.floor(interpolate(frame, [typeFrom, typeFrom + typeFrames], [0, brief.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const caret = frame < submitAt && frame % 16 < 8;
  return (
    <AppCanvas>
      <StackHeader title="New promo" />
      <div style={{ padding: 16 }}>
        <FormCard title="BRIEF · 5 PROMOTIONS LEFT">
          <Label required>What do you want to promote?</Label>
          <div style={{ height: 105, borderRadius: 12, border: `1.5px solid ${frame < submitAt ? manage.teal : manage.line}`, padding: "14px 14px", fontSize: 16, color: manage.text }}>
            {brief.slice(0, chars)}
            {caret && <span style={{ color: manage.teal }}>|</span>}
          </div>
          <div style={{ fontSize: 13.5, color: manage.textSecondary, marginTop: 12 }}>The AI drafts the banner, copy and discount, usually in about a minute</div>
        </FormCard>
        <FormCard title="BANNER">
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ padding: "9px 16px", borderRadius: 20, background: "#101628", color: "#fff", fontSize: 15, fontWeight: 600 }}>Let AI design it</span>
            <span style={{ padding: "9px 16px", borderRadius: 20, border: `1px solid ${manage.line}`, color: manage.text, fontSize: 15, fontWeight: 500 }}>Upload my own</span>
          </div>
          <div style={{ fontSize: 13.5, color: manage.textSecondary, marginTop: 10 }}>The AI paints the banner from your brief.</div>
        </FormCard>
        <FormCard title="OPTIONS">
          <Option title="Launch automatically" hint="Skips the review step" on={false} />
          <Option title="Notify customers" hint="One push per day at most" on />
        </FormCard>
      </div>
      <BottomButton enabled={chars > 0} pressed={frame >= submitAt && frame < submitAt + 5}>
        <SubmitLabel submitAt={submitAt} doneAt={doneAt} />
      </BottomButton>
    </AppCanvas>
  );
};
