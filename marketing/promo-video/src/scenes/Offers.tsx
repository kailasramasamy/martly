import { PhoneScene } from "../components/PhoneScene";
import { ScreenFlow } from "../components/ScreenFlow";
import { useCopy } from "../copy";

const COUPONS_AT = 90;

export const Offers = () => {
  const copy = useCopy();
  return (
    <PhoneScene captions={[{ from: 0, to: COUPONS_AT - 4, lines: copy.offers }, { from: COUPONS_AT - 4, lines: copy.offersCoupons }]}>
      <ScreenFlow steps={[{ at: 0, screen: "screens/v2/06b-manage-offer-create.png", tap: { x: 461, y: 1013, at: COUPONS_AT + 30 } }]} />
    </PhoneScene>
  );
};
