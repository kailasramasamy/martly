import { useLocalSearchParams } from "expo-router";
import { CreditCampaignForm } from "../../../components/manage/credits/CreditCampaignForm";

export default function EditWelcomeCredit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CreditCampaignForm id={id} />;
}
