import { useLocalSearchParams } from "expo-router";
import { BannerForm } from "../../../components/manage/marketing/BannerForm";

export default function EditBanner() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BannerForm id={id} />;
}
