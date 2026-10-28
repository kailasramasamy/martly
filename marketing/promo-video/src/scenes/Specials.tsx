import { PhoneScene } from "../components/PhoneScene";
import { ScreenFlow } from "../components/ScreenFlow";
import { useCopy } from "../copy";

const WALK_AT = 75;

export const Specials = () => {
  const copy = useCopy();
  return (
    <PhoneScene captions={[{ from: 0, to: WALK_AT - 4, lines: copy.specials }, { from: WALK_AT - 4, lines: copy.walk }]}>
      <ScreenFlow
        steps={[
          { at: 0, screen: copy.homeScreen },
          { at: WALK_AT, screen: "screens/v2/12-shop-home-specials.png", tap: { x: 461, y: 1157, at: 132 } },
        ]}
      />
    </PhoneScene>
  );
};
