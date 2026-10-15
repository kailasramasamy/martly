import { useLocalSearchParams } from "expo-router";
import { TemplateForm } from "../../../../components/manage/marketing/notifications/TemplateForm";

export default function EditTemplate() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TemplateForm id={id} />;
}
