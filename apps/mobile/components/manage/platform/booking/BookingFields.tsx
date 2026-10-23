import { View, StyleSheet } from "react-native";
import { SectionCard } from "../../ui/SectionCard";
import { SelectField } from "../../ui/SelectField";
import { TextField } from "../../ui/TextField";
import { toDateKey } from "../../ui/dates";
import type { SelectOption } from "../../ui/OptionSheet";
import type { BrandPackage, Campaign } from "../types";
import { AvailabilityLine } from "./AvailabilityLine";
import { PackageField } from "./PackageField";
import { FeatureCategoryField } from "./FeatureCategoryField";
import { StartDateField } from "./StartDateField";
import { SearchPicker } from "./SearchPicker";
import { isFeature, isKind, startsAtIso, type FormErrors, type FormState } from "./form-state";

const DISCOUNT_OPTIONS: SelectOption[] = [{ value: "PERCENTAGE", label: "Percentage off" }, { value: "FLAT", label: "Flat amount off" }];

interface Props {
  state: FormState;
  errors: FormErrors;
  onChange: (patch: Partial<FormState>) => void;
  packages: BrandPackage[];
  categories: SelectOption[];
  product?: BrandPackage;
  campaign: Campaign | null;
  /** Paid: package, length, category and discount are bought */
  locked: boolean;
}

/** Fields that only some packages need: takeover or featured category, promotion discount */
function KindFields({ state, errors, onChange, categories, product, locked }: Props) {
  return (
    <>
      {isKind(product, "BRAND_TAKEOVER") ? (
        <SelectField label="Category to take over" required value={state.categoryId} options={categories} onChange={(categoryId) => onChange({ categoryId })} error={errors.categoryId} disabled={locked} placeholder="Choose a category" />
      ) : null}
      {isFeature(product) ? (
        <FeatureCategoryField brandId={state.brandId} value={state.categoryId} onChange={(categoryId) => onChange({ categoryId })} disabled={locked} error={errors.categoryId} />
      ) : null}
      {isKind(product, "BRAND_PROMOTION") ? (
        <View style={styles.pair}>
          <View style={styles.half}>
            <SelectField label="Discount type" required value={state.discountType} options={DISCOUNT_OPTIONS} onChange={(v) => onChange({ discountType: v as FormState["discountType"] })} error={errors.discountType} disabled={locked} />
          </View>
          <View style={styles.half}>
            <TextField label="Discount value" required keyboardType="number-pad" value={state.discountValue} onChangeText={(t) => onChange({ discountValue: t.replace(/\D/g, "") })} maxLength={2} error={errors.discountValue} editable={!locked} />
          </View>
        </View>
      ) : null}
    </>
  );
}

/** Brand, package, length, start date and the price/availability under them */
export function BookingFields(props: Props) {
  const { state, errors, onChange, packages, product, campaign, locked } = props;
  const units = isKind(product, "BRAND_CPM") ? "Thousands of views" : "Weeks";
  const pickBrand = (b: { id: string }) => onChange({ brandId: b.id, actionTarget: null, categoryId: null });
  return (
    <SectionCard title="Booking">
      <SearchPicker<{ id: string; name: string }>
        label="Brand" required path="/api/v1/brands" value={state.brandId} initialLabel={campaign?.brand.name}
        onPick={pickBrand} placeholder="Search brands" disabled={!!campaign} error={errors.brandId}
      />
      <PackageField value={state.productId} packages={packages} onChange={(productId) => onChange({ productId })} error={errors.productId} disabled={locked} />
      <View style={styles.pair}>
        <View style={styles.half}>
          <TextField label={units} required keyboardType="number-pad" value={state.quantity} onChangeText={(t) => onChange({ quantity: t.replace(/\D/g, "") })} maxLength={2} error={errors.quantity} editable={!locked} />
        </View>
        <View style={styles.half}>
          <StartDateField
            value={state.startDate} error={errors.startDate} product={product} quantity={Number(state.quantity)}
            categoryId={state.categoryId} excludeId={campaign?.id} onChange={onChange}
          />
        </View>
      </View>
      <KindFields {...props} />
      <AvailabilityLine
        product={product} quantity={Number(state.quantity)} startsAt={startsAtIso(state)}
        categoryId={state.categoryId} excludeId={campaign?.id} onUseStart={(next) => onChange({ startDate: toDateKey(new Date(next)), startTime: next })}
      />
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: "row", gap: 12 },
  half: { flex: 1 },
});
