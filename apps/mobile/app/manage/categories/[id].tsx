import { useLocalSearchParams } from "expo-router";
import { TaxonomyBrowser } from "../../../components/manage/taxonomy/TaxonomyBrowser";
import { isTaxonomyLevel } from "../../../components/manage/taxonomy/paths";

export default function CategoryScreen() {
  const { id, level } = useLocalSearchParams<{ id: string; level?: string }>();
  return <TaxonomyBrowser level={isTaxonomyLevel(level) ? level : "department"} id={id} />;
}
