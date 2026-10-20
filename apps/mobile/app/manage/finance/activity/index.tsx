import { AccessGate } from "../../../../components/manage/support/AccessGate";
import { ActivityList } from "../../../../components/manage/finance/ActivityList";

export default function ActivityRoute() {
  return <AccessGate resource="finance"><ActivityList /></AccessGate>;
}
