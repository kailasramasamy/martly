import { useLocalSearchParams } from "expo-router";
import { DraftDetailScreen } from "../../../components/manage/catalog-drafts/DraftDetailScreen";

export default function CatalogDraftScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DraftDetailScreen id={id} />;
}
