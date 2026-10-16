import { useLocalSearchParams } from "expo-router";
import { AccessGate } from "../../../components/manage/support/AccessGate";
import { CountDetailScreen } from "../../../components/manage/stock/CountDetailScreen";

export default function StockCountDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AccessGate resource="stock-counts"><CountDetailScreen id={id} /></AccessGate>;
}
