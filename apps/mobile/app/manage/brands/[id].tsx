import { useLocalSearchParams } from "expo-router";
import { BrandDetailScreen } from "../../../components/manage/taxonomy/BrandDetailScreen";

export default function BrandScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BrandDetailScreen id={id} />;
}
