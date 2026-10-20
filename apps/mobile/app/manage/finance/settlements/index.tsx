import { AccessGate } from "../../../../components/manage/support/AccessGate";
import { SettlementList } from "../../../../components/manage/finance/SettlementList";

export default function SettlementsRoute() {
  return <AccessGate resource="finance"><SettlementList /></AccessGate>;
}
