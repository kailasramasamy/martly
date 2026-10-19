import { AbsoluteFill, Img, interpolate, staticFile } from "remotion";
import { AddProductScreen } from "../app-ui/AddProductScreen";
import { Backdrop } from "../components/Backdrop";
import { Caption } from "../components/Caption";
import { PhoneFrame } from "../components/PhoneFrame";
import { usePop } from "../components/usePop";
import { useCopy } from "../copy";
import { colors } from "../theme";

const SHOTS = [22, 36, 50];
const PRICE_FROM = 62;
const SUBMIT_AT = 98;
const ListedCard = () => {
  const copy = useCopy();
  const product = copy.snapProduct;
  const p = usePop(SUBMIT_AT + 8, 12);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 28, width: 900, padding: "28px 34px", borderRadius: 36, background: colors.surface, boxShadow: "0 30px 70px rgba(0,0,0,0.45)", transform: `translateY(${interpolate(p, [0, 1], [500, 0])}px)` }}>
      <Img src={staticFile(product.image)} style={{ width: 110, height: 110, objectFit: "contain" }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 38, fontWeight: 800, color: colors.text }}>{product.name}</div>
        <div style={{ fontSize: 28, fontWeight: 600, color: colors.textSecondary }}>{product.detail}</div>
      </div>
      <div style={{ padding: "14px 24px", borderRadius: 999, background: "#dcfce7", color: "#15803d", fontSize: 30, fontWeight: 800 }}>{copy.listed}</div>
    </div>
  );
};

export const Snap = () => {
  const copy = useCopy();
  const product = copy.snapProduct;
  const p = usePop(0, 18);
  return (
    <Backdrop tone="night">
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 150 }}>
        <Caption lines={copy.snap} size={74} stagger={10} />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", top: 470 }}>
        <PhoneFrame style={{ transform: `translateY(${interpolate(p, [0, 1], [600, 0])}px)` }}>
          <AddProductScreen image={product.image} shots={SHOTS} mrp="140" price="120" priceFrom={PRICE_FROM} submitAt={SUBMIT_AT} />
        </PhoneFrame>
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: 120 }}>
        <ListedCard />
      </AbsoluteFill>
    </Backdrop>
  );
};
