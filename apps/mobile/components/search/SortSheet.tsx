import { SearchSortBy } from "@martly/shared/constants";
import { useStrings } from "../../lib/i18n/use-strings";
import { RadioOptionSheet, type RadioOption } from "./RadioOptionSheet";

const SORT_VALUES = Object.values(SearchSortBy);

interface SortSheetProps {
  visible: boolean;
  selected: SearchSortBy;
  onSelect: (value: SearchSortBy) => void;
  onClose: () => void;
}

export function SortSheet({ visible, selected, onSelect, onClose }: SortSheetProps) {
  const t = useStrings("search");
  const options: RadioOption<SearchSortBy>[] = SORT_VALUES.map((value) => ({ value, label: t.sortLabels[value] }));
  return <RadioOptionSheet visible={visible} title={t.sortBy} options={options} selected={selected} onSelect={onSelect} onClose={onClose} />;
}
