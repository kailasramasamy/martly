import { AccessGate } from "../../../components/manage/support/AccessGate";
import { ReceiveScreen } from "../../../components/manage/stock/ReceiveScreen";

export default function ReceiveStockRoute() {
  return <AccessGate resource="stock-receive"><ReceiveScreen /></AccessGate>;
}
