import { PaySheet } from "../components/PaySheet";
import { PhoneScene } from "../components/PhoneScene";
import { ScreenFlow, Screenshot } from "../components/ScreenFlow";
import { useCopy } from "../copy";

const PAY_AT = 195;
const CART_TOTAL = 762;

export const Shop = () => {
  const copy = useCopy();
  return (
    <PhoneScene captions={[{ from: 0, to: PAY_AT - 4, lines: copy.shop }, { from: PAY_AT - 4, lines: copy.pay }]}>
      <ScreenFlow
        steps={[
          { at: 0, screen: copy.homeScreen, tap: { x: 511, y: 942, at: 50 } },
          { at: 70, screen: "screens/v2/16-shop-cart.png", tap: { x: 697, y: 1707, at: 120 } },
          {
            at: 135,
            screen: (
              <>
                <Screenshot src="screens/v2/17b-shop-checkout-slots.png" />
                <PaySheet startAt={PAY_AT} total={CART_TOTAL} />
              </>
            ),
            tap: { x: 680, y: 1820, at: 185 },
          },
        ]}
      />
    </PhoneScene>
  );
};
