import { useLocalSearchParams } from "expo-router";
import { AccessGate } from "../../../../components/manage/support/AccessGate";
import { EntryDetail } from "../../../../components/manage/finance/EntryDetail";

export default function EntryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AccessGate resource="finance"><EntryDetail id={id} /></AccessGate>;
}
