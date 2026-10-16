import { useLocalSearchParams } from "expo-router";
import { MemberDetailScreen } from "../../../components/manage/org/MemberDetailScreen";

export default function TeamMemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <MemberDetailScreen id={id} />;
}
