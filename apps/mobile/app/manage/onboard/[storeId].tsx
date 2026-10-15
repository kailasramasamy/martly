import { useLocalSearchParams } from "expo-router";
import { OnboardScreen } from "../../../components/manage/onboard/OnboardScreen";

export default function OnboardRoute() {
  const { storeId } = useLocalSearchParams<{ storeId: string }>();
  return <OnboardScreen storeId={storeId} />;
}
