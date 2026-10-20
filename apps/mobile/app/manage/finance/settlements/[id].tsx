import { useLocalSearchParams } from "expo-router";
import { AccessGate } from "../../../../components/manage/support/AccessGate";
import { SettlementScreen } from "../../../../components/manage/finance/SettlementScreen";

export default function SettlementRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AccessGate resource="finance"><SettlementScreen id={id} /></AccessGate>;
}
