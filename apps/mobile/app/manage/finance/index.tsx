import { AccessGate } from "../../../components/manage/support/AccessGate";
import { FinanceOverview } from "../../../components/manage/finance/FinanceOverview";

export default function FinanceRoute() {
  return <AccessGate resource="finance"><FinanceOverview /></AccessGate>;
}
