import { View, Text, StyleSheet } from "react-native";
import { SelectField } from "../ui/SelectField";
import { TextField } from "../ui/TextField";
import { SwitchRow } from "../ui/SwitchRow";
import { colors, fonts } from "../../../constants/theme";
import { useManageScope } from "../../../lib/manage-scope-context";
import { ImageSource } from "./ImageSource";
import { useTaxonomyOptions } from "./taxonomy";
import { PLACEMENT_OPTIONS, type BannerDraft, type DraftErrors } from "./banner-draft";
import type { Entitlements } from "./plan-types";

export interface PromoContext {
  title: string;
  subtitle: string;
  actionType: string;
  actionTarget: string;
}

interface Props {
  draft: BannerDraft;
  onChange: (patch: Partial<BannerDraft>) => void;
  promo: PromoContext;
  errors?: DraftErrors;
  entitlements: Entitlements | null;
}

/** Placement, artwork, optional wording and scope of one promotion banner */
export function BannerDraftFields({ draft, onChange, promo, errors, entitlements }: Props) {
  const { stores } = useManageScope();
  const taxonomy = useTaxonomyOptions();
  const storeOptions = [{ value: "", label: "All stores (org-wide)" }, ...stores.map((s) => ({ value: s.id, label: s.name }))];
  return (
    <View style={styles.fields}>
      <SelectField label="Placement" required value={draft.placement} options={PLACEMENT_OPTIONS} onChange={(placement) => onChange({ placement })} error={errors?.placement} />
      <ImageSource
        imageUrl={draft.imageUrl} onImage={(imageUrl) => onChange({ imageUrl })} entitlements={entitlements} error={errors?.imageUrl}
        title={draft.title || promo.title} subtitle={draft.subtitle || promo.subtitle} actionType={promo.actionType} actionTarget={promo.actionTarget}
        onGenerated={(art) => onChange({ imageUrl: art.imageUrl, textInImage: art.textInImage })}
      />
      <SwitchRow label="Title is part of the image" description="When on, the app adds no text over the artwork" value={draft.textInImage} onValueChange={(textInImage) => onChange({ textInImage })} />
      <Text style={styles.note}>Leave the wording empty to reuse the promotion's title and subtitle.</Text>
      <TextField label="Banner title" value={draft.title} onChangeText={(title) => onChange({ title })} maxLength={60} />
      <TextField label="Banner subtitle" value={draft.subtitle} onChangeText={(subtitle) => onChange({ subtitle })} maxLength={90} />
      <SelectField label="Store" value={draft.storeId} options={storeOptions} onChange={(storeId) => onChange({ storeId })} />
      {draft.placement === "CATEGORY_TOP" ? (
        <SelectField label="Category (optional)" value={draft.taxonomy} options={taxonomy.options} onChange={(value) => onChange({ taxonomy: value })} placeholder="All categories (generic)" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 4 },
  note: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginBottom: 8 },
});
