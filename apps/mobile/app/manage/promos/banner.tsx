import { useLocalSearchParams } from "expo-router";
import { PromoBannerForm } from "../../../components/manage/marketing/PromoBannerForm";

export default function PromoBanner() {
  const { promoId, bannerId } = useLocalSearchParams<{ promoId: string; bannerId?: string }>();
  return <PromoBannerForm promoId={promoId} bannerId={bannerId} />;
}
