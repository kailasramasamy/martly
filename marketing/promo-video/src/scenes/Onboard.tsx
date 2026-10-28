import { PhoneScene } from "../components/PhoneScene";
import { ScreenFlow } from "../components/ScreenFlow";
import { useCopy } from "../copy";

const PRICES_AT = 150;

export const Onboard = () => {
  const copy = useCopy();
  return (
    <PhoneScene tone="night" captions={[{ from: 0, to: PRICES_AT - 4, lines: copy.onboard }, { from: PRICES_AT - 4, lines: copy.onboardPrices }]}>
      <ScreenFlow
        steps={[
          { at: 0, screen: "screens/v2/04a-manage-inventory.png", tap: { x: 460, y: 628, at: 52 } },
          { at: 70, screen: "screens/v2/04b-manage-stock-check.png", tap: { x: 193, y: 1220, at: 120 } },
          { at: PRICES_AT, screen: "screens/v2/05-manage-price-review.png" },
        ]}
      />
    </PhoneScene>
  );
};
