import { BannerActionTypeLabels } from "@martly/shared/constants";
import { TextField } from "../ui/TextField";
import { SelectField } from "../ui/SelectField";
import { RemotePicker } from "./RemotePicker";
import { useTaxonomyOptions } from "./taxonomy";

export const ACTION_OPTIONS = Object.entries(BannerActionTypeLabels).map(([value, label]) => ({ value, label }));

interface Props {
  actionType: string;
  value: string;
  onChange: (target: string) => void;
  error?: string;
}

/** Picks what a promotion or banner leads to, matching the chosen action type */
export function BannerTargetField({ actionType, value, onChange, error }: Props) {
  const taxonomy = useTaxonomyOptions();
  if (actionType === "CATEGORY") {
    const options = taxonomy.options.map((o) => ({ value: o.id, label: o.label }));
    return <SelectField label="Target category" required value={value || null} options={options} onChange={onChange} error={error} placeholder={taxonomy.loading ? "Loading..." : "Select"} />;
  }
  if (actionType === "PRODUCT") return <RemotePicker label="Target product" required path="/api/v1/products" value={value || null} onChange={onChange} error={error} />;
  if (actionType === "COLLECTION") return <RemotePicker label="Target collection" required path="/api/v1/collections" value={value || null} onChange={onChange} error={error} />;
  if (actionType === "BRAND") return <RemotePicker label="Target brand" required path="/api/v1/brands" value={value || null} onChange={onChange} error={error} />;
  if (actionType === "SEARCH") return <TextField label="Search query" required value={value} onChangeText={onChange} placeholder="e.g. organic fruits" error={error} />;
  if (actionType === "URL") return <TextField label="URL" required value={value} onChangeText={onChange} autoCapitalize="none" keyboardType="url" placeholder="https://" error={error} />;
  return null;
}

export function validateTarget(actionType: string, target: string): string | undefined {
  if (actionType === "NONE") return undefined;
  if (!target.trim()) return "Choose a target";
  if (actionType === "URL" && !/^https?:\/\/\S+$/.test(target.trim())) return "Enter a full URL starting with https://";
  return undefined;
}
