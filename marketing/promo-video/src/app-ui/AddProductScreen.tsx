import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { ArrowRight, Camera, Images } from "lucide-react";
import { AppCanvas, StackHeader } from "./Canvas";
import { BottomButton, Field, FormCard, Label } from "./Form";
import { manage } from "./tokens";

type Props = { image: string; shots: number[]; mrp: string; price: string; priceFrom: number; submitAt: number };

const typed = (text: string, frame: number, from: number) =>
  text.slice(0, Math.floor(interpolate(frame, [from, from + 10], [0, text.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));

const Thumbs = ({ image, count }: { image: string; count: number }) => (
  <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
    {Array.from({ length: count }, (_, i) => (
      <div key={i} style={{ width: 64, height: 64, borderRadius: 10, border: `1px solid ${manage.line}`, background: "#fff", padding: 6 }}>
        <Img src={staticFile(image)} style={{ width: "100%", height: "100%", objectFit: "contain", transform: `rotate(${[0, -8, 10][i] ?? 0}deg)` }} />
      </div>
    ))}
  </div>
);

export const AddProductScreen = ({ image, shots, mrp, price, priceFrom, submitAt }: Props) => {
  const frame = useCurrentFrame();
  const count = shots.filter((s) => frame >= s).length;
  const flash = shots.some((s) => frame >= s && frame < s + 4);
  const mrpText = typed(mrp, frame, priceFrom);
  const priceText = typed(price, frame, priceFrom + 14);
  return (
    <AppCanvas>
      <StackHeader title="Add product" />
      <div style={{ padding: 16 }}>
        <FormCard title={`PHOTOS (${count}/8)`}>
          {count > 0 ? (
            <Thumbs image={image} count={count} />
          ) : (
            <div style={{ fontSize: 15, color: manage.textSecondary, lineHeight: 1.4, marginBottom: 14 }}>
              Start with the front of the pack, then the back, sides and nutrition panel.
            </div>
          )}
          <div style={{ height: 48, borderRadius: 12, background: manage.button, color: "#fff", fontSize: 17, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, transform: `scale(${flash ? 0.96 : 1})` }}>
            <Camera size={20} /> Take photo
          </div>
          <div style={{ height: 40, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: manage.button, fontSize: 16, fontWeight: 600, marginTop: 6 }}>
            <Images size={20} /> Add from gallery
          </div>
        </FormCard>
        <FormCard title="DETAILS">
          <Label>Name</Label>
          <Field placeholder="Optional — AI will read it" />
          <Label required>MRP</Label>
          <Field prefix={"₹"} value={mrpText} />
          <Label required>Selling price</Label>
          <Field prefix={"₹"} value={priceText} />
        </FormCard>
      </div>
      <BottomButton enabled={priceText.length === price.length} pressed={frame >= submitAt && frame < submitAt + 5}>
        <ArrowRight size={20} /> Submit & next
      </BottomButton>
      {flash && <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: 0.85 }} />}
    </AppCanvas>
  );
};
