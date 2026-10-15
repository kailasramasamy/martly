import { useLocalSearchParams } from "expo-router";
import { FestivalForm } from "../../../components/manage/marketing/FestivalForm";

export default function EditFestival() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FestivalForm id={id} />;
}
