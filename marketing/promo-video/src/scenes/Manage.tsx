import { AbsoluteFill, Sequence, interpolate } from "remotion";
import { InventoryScreen } from "../app-ui/InventoryScreen";
import { TodayScreen } from "../app-ui/TodayScreen";
import { Backdrop } from "../components/Backdrop";
import { Caption } from "../components/Caption";
import { PhoneFrame } from "../components/PhoneFrame";
import { ScreenFlow } from "../components/ScreenFlow";
import { usePop } from "../components/usePop";
import { useCopy } from "../copy";

const STOCK_AT = 95;

export const Manage = () => {
  const copy = useCopy();
  const p = usePop(0, 18);
  return (
    <Backdrop tone="night">
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 150 }}>
        <Sequence durationInFrames={STOCK_AT - 4} layout="none">
          <Caption lines={copy.manage} size={92} />
        </Sequence>
        <Sequence from={STOCK_AT - 4} layout="none">
          <Caption lines={copy.stockAlert} size={92} />
        </Sequence>
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", top: 470 }}>
        <PhoneFrame style={{ transform: `translateY(${interpolate(p, [0, 1], [600, 0])}px)` }}>
          <ScreenFlow
            steps={[
              { at: 0, screen: <TodayScreen /> },
              { at: STOCK_AT, screen: <Sequence from={STOCK_AT - 8} layout="none"><InventoryScreen /></Sequence> },
            ]}
          />
        </PhoneFrame>
      </AbsoluteFill>
    </Backdrop>
  );
};
