import { AccessGate } from "../../../components/manage/support/AccessGate";
import { PayoutAccountScreen } from "../../../components/manage/finance/PayoutAccountScreen";

export default function PayoutAccountRoute() {
  return <AccessGate resource="finance"><PayoutAccountScreen /></AccessGate>;
}
