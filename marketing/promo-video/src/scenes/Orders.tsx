import { PhoneScene } from "../components/PhoneScene";
import { Screenshot } from "../components/ScreenFlow";
import { useCopy } from "../copy";

export const Orders = () => {
  const copy = useCopy();
  return (
    <PhoneScene captions={[{ from: 0, lines: copy.orders }]}>
      <Screenshot src="screens/v2/03-manage-orders.png" />
    </PhoneScene>
  );
};
