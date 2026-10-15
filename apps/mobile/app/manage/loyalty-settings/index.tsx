import { useRouter } from "expo-router";
import { LoyaltySettingsForm } from "../../../components/manage/marketing/LoyaltySettingsForm";

export default function LoyaltySettingsScreen() {
  const router = useRouter();
  return <LoyaltySettingsForm onCustomers={() => router.push("/manage/loyalty-settings/customers")} />;
}
