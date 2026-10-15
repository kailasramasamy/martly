import { useRouter } from "expo-router";
import { ReferralSettingsForm } from "../../../components/manage/marketing/ReferralSettingsForm";

export default function ReferralSettingsScreen() {
  const router = useRouter();
  return <ReferralSettingsForm onList={() => router.push("/manage/referral-settings/list")} />;
}
