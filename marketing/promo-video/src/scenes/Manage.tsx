import { PhoneScene } from "../components/PhoneScene";
import { ScreenFlow } from "../components/ScreenFlow";
import { useCopy } from "../copy";

const COACH_AT = 105;

export const Manage = () => {
  const copy = useCopy();
  return (
    <PhoneScene tone="night" captions={[{ from: 0, to: COACH_AT - 4, lines: copy.manage }, { from: COACH_AT - 4, lines: copy.coach }]}>
      <ScreenFlow
        steps={[
          { at: 0, screen: "screens/v2/01-manage-today.png" },
          { at: COACH_AT, screen: "screens/v2/02-manage-storefront-score.png", tap: { x: 461, y: 1150, at: 175 } },
        ]}
      />
    </PhoneScene>
  );
};
