import { SearchSortBy, SearchSortLabels } from "@martly/shared/constants";
import { RadioOptionSheet, type RadioOption } from "./RadioOptionSheet";

const OPTIONS: RadioOption<SearchSortBy>[] = (Object.keys(SearchSortLabels) as SearchSortBy[]).map((value) => ({
  value,
  label: SearchSortLabels[value],
}));

interface SortSheetProps {
  visible: boolean;
  selected: SearchSortBy;
  onSelect: (value: SearchSortBy) => void;
  onClose: () => void;
}

export function SortSheet({ visible, selected, onSelect, onClose }: SortSheetProps) {
  return <RadioOptionSheet visible={visible} title="Sort by" options={OPTIONS} selected={selected} onSelect={onSelect} onClose={onClose} />;
}
