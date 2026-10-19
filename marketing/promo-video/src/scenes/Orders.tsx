import { AbsoluteFill, interpolate } from "remotion";
import { OrdersScreen } from "../app-ui/OrdersScreen";
import { Backdrop } from "../components/Backdrop";
import { Caption } from "../components/Caption";
import { PhoneFrame } from "../components/PhoneFrame";
import { usePop } from "../components/usePop";
import { useCopy } from "../copy";

export const Orders = () => {
  const copy = useCopy();
  const p = usePop(0, 18);
  return (
    <Backdrop tone="teal">
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 150 }}>
        <Caption lines={copy.orders} size={96} stagger={10} />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", top: 470 }}>
        <PhoneFrame style={{ transform: `translateY(${interpolate(p, [0, 1], [600, 0])}px)` }}>
          <OrdersScreen />
        </PhoneFrame>
      </AbsoluteFill>
    </Backdrop>
  );
};
