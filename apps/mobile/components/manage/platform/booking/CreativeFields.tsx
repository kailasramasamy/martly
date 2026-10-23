import { View, Text, StyleSheet } from "react-native";
import { BANNER_IMAGE_REQUIREMENTS } from "@martly/shared/constants";
import { SectionCard } from "../../ui/SectionCard";
import { TextField } from "../../ui/TextField";
import { SegmentedTabs } from "../../ui/SegmentedTabs";
import { ImageField } from "../../ui/ImageField";
import { FieldFrame } from "../../ui/FieldFrame";
import { colors, fonts } from "../../../../constants/theme";
import type { BrandPackage } from "../types";
import { isFeature, isKind, isPoster, isSponsored, isTabSlot, type FormErrors, type FormState } from "./form-state";
import { SponsoredProductField, type SponsorableProduct } from "./SponsoredProductField";

const POSTER_HINT = "Tall 2:3 poster, text in the image";
const STRIP_HINT = "Wide 2:1 strip for the top of the category page, at least 1200 × 600 px, text in the image and kept to the middle";
const MODES = [{ value: "upload", label: "Upload image" }, { value: "ai", label: "Generate with AI" }] as const;

const NAME_ONLY = {
  feature: {
    title: "Featured brand",
    text: "The brand's products in the chosen category rank ahead in search, category pages and list orders, marked Featured, in the stores it runs in that carry the brand. A store's own brand still comes first. No banner or push.",
  },
  tab: {
    title: "Brand tab slot",
    text: "The brand's logo takes the last slot of the app's bottom bar and opens its brand page, in the stores it runs in that carry the brand. One brand at a time. The brand needs a logo. No banner or push.",
  },
};

interface Props {
  product?: BrandPackage;
  state: FormState;
  errors: FormErrors;
  onChange: (patch: Partial<FormState>) => void;
  /** Package, product and category are bought and can't change */
  locked: boolean;
  /** The creative can't change once approved */
  frozen: boolean;
  campaign: { title: string; category: string | null } | null;
}

function NameOnlyCard({ kind, state, errors, onChange, frozen }: { kind: keyof typeof NAME_ONLY } & Pick<Props, "state" | "errors" | "onChange" | "frozen">) {
  const copy = NAME_ONLY[kind];
  return (
    <SectionCard title={copy.title}>
      <TextField label="Campaign name" required value={state.title} onChangeText={(title) => onChange({ title })} maxLength={60} error={errors.title} hint="For your records; shoppers don't see it." editable={!frozen} />
      <Text style={styles.note}>{copy.text}</Text>
    </SectionCard>
  );
}

function ImageSection({ product, state, errors, onChange, frozen }: Pick<Props, "product" | "state" | "errors" | "onChange" | "frozen">) {
  const poster = isPoster(product);
  const wide = isKind(product, "BRAND_TAKEOVER");
  const noun = poster ? "poster" : "banner";
  return (
    <SectionCard title="Creative">
      <View pointerEvents={frozen ? "none" : "auto"} style={frozen && styles.frozen}>
        <FieldFrame><SegmentedTabs options={[...MODES]} value={state.creativeMode} onChange={(creativeMode) => onChange({ creativeMode })} /></FieldFrame>
        {state.creativeMode === "upload" ? (
          <>
            {poster || wide
              ? <Text style={styles.guide}>{poster ? POSTER_HINT : STRIP_HINT}</Text>
              : BANNER_IMAGE_REQUIREMENTS.guidance.map((g) => <Text key={g} style={styles.guide}>{`• ${g}`}</Text>)}
            <ImageField value={state.imageUrl} onChange={(imageUrl) => onChange({ imageUrl })} aspect={poster ? 2 / 3 : wide ? 2 : 1.5} error={errors.imageUrl} />
          </>
        ) : (
          <>
            <TextField label="What should the picture show?" required multiline value={state.brief} onChangeText={(brief) => onChange({ brief })} maxLength={600} error={errors.brief} />
            <Text style={styles.guide}>{`Save first, then press Generate ${noun} on the campaign page.`}</Text>
          </>
        )}
      </View>
    </SectionCard>
  );
}

/** The creative for the chosen package: name only, a sponsored product, or title, subtitle and artwork */
export function CreativeFields(props: Props) {
  const { product, state, errors, onChange, locked, frozen, campaign } = props;
  if (isFeature(product)) return <NameOnlyCard kind="feature" {...props} />;
  if (isTabSlot(product)) return <NameOnlyCard kind="tab" {...props} />;
  if (isSponsored(product)) {
    const onPick = (p: SponsorableProduct) => onChange({ actionTarget: p.id, categoryId: p.subcategory?.category.id ?? null, title: p.name.slice(0, 60) });
    return (
      <SponsoredProductField
        brandId={state.brandId} value={state.actionTarget} onPick={onPick} disabled={locked || frozen} error={errors.actionTarget}
        initial={campaign ? { name: campaign.title, category: campaign.category } : undefined}
      />
    );
  }
  return (
    <>
      <SectionCard title={isPoster(product) ? "Poster text" : "Banner text"}>
        <TextField label="Title" required value={state.title} onChangeText={(title) => onChange({ title })} maxLength={60} error={errors.title} editable={!frozen} />
        <TextField label="Subtitle" value={state.subtitle} onChangeText={(subtitle) => onChange({ subtitle })} maxLength={90} editable={!frozen} />
      </SectionCard>
      <ImageSection {...props} />
    </>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  guide: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18, color: colors.textSecondary, marginBottom: 6 },
  frozen: { opacity: 0.5 },
});
