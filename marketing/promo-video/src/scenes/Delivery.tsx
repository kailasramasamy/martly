import { PhoneScene } from "../components/PhoneScene";
import { ScreenFlow } from "../components/ScreenFlow";
import { useCopy } from "../copy";

const TRACK_AT = 95;

export const Delivery = () => {
  const copy = useCopy();
  return (
    <PhoneScene tone="night" captions={[{ from: 0, to: TRACK_AT - 4, lines: copy.delivery }, { from: TRACK_AT - 4, lines: copy.track }]}>
      <ScreenFlow
        steps={[
          { at: 0, screen: "screens/v2/08-manage-delivery.png", tap: { x: 461, y: 924, at: 65 } },
          { at: TRACK_AT, screen: "screens/v2/18-shop-live-tracking-clean.png" },
        ]}
      />
    </PhoneScene>
  );
};
