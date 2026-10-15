import { useLocalSearchParams } from "expo-router";
import { MembershipPlanForm } from "../../../components/manage/marketing/MembershipPlanForm";

export default function EditPlan() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MembershipPlanForm id={id} />;
}
