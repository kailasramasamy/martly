import { AbsoluteFill, Sequence, interpolate } from "remotion";
import { Backdrop } from "../components/Backdrop";
import { Caption } from "../components/Caption";
import { PaySheet } from "../components/PaySheet";
import { PhoneFrame } from "../components/PhoneFrame";
import { ScreenFlow, Screenshot, type Step } from "../components/ScreenFlow";
import { usePop } from "../components/usePop";
import { useCopy, type Copy } from "../copy";

const PAY_AT = 140;
const TRACK_AT = 200;
const CART_TOTAL = 313;

const steps = (home: string): Step[] => [
  { at: 0, screen: home, tap: { x: 459, y: 1210, at: 30 } },
  { at: 38, screen: "screens/04-category.png", tap: { x: 755, y: 650, at: 64 } },
  { at: 72, screen: "screens/05-product.png", tap: { x: 738, y: 1868, at: 96 } },
  {
    at: 104,
    screen: (
      <>
        <Screenshot src="screens/06-cart.png" />
        <PaySheet startAt={PAY_AT} total={CART_TOTAL} />
      </>
    ),
    tap: { x: 697, y: 1665, at: 132 },
  },
  { at: TRACK_AT, screen: "screens/07-order.png" },
];

const captions = (copy: Copy) => [
  { from: 0, to: PAY_AT - 4, lines: copy.shop },
  { from: PAY_AT - 4, to: TRACK_AT - 4, lines: copy.pay },
  { from: TRACK_AT - 4, to: 999, lines: copy.track },
];

export const Shop = () => {
  const copy = useCopy();
  const p = usePop(0, 18);
  return (
    <Backdrop tone="teal">
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 150 }}>
        {captions(copy).map((c) => (
          <Sequence key={c.from} from={c.from} durationInFrames={c.to - c.from} layout="none">
            <Caption lines={c.lines} size={92} />
          </Sequence>
        ))}
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", top: 470 }}>
        <PhoneFrame style={{ transform: `translateY(${interpolate(p, [0, 1], [600, 0])}px)` }}>
          <ScreenFlow steps={steps(copy.shopHome)} />
        </PhoneFrame>
      </AbsoluteFill>
    </Backdrop>
  );
};
