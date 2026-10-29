import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, fonts, radius } from "../../../constants/theme";
import { uploadLogo } from "../../../lib/upload";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { manage } from "../../../components/manage/ui/tokens";
import { Button } from "../../../components/manage/ui/Button";
import { ImageField } from "../../../components/manage/ui/ImageField";
import { SectionCard } from "../../../components/manage/ui/SectionCard";
import { TextField } from "../../../components/manage/ui/TextField";
import { fieldStyles } from "../../../components/manage/ui/fieldStyles";
import { useBranding, type BrandingForm } from "../../../components/manage/storefront/use-branding";

const HEX = /^#[0-9a-fA-F]{6}$/;

function Words({ form, patch, draft, drafting }: { form: BrandingForm; patch: (p: Partial<BrandingForm>) => void; draft: () => void; drafting: boolean }) {
  return (
    <SectionCard title="Tagline & highlights">
      <View style={styles.fields}>
        <View style={styles.ai}>
          <Text style={styles.aiText}>We write these from what your shop sells and how it delivers. You check them before saving.</Text>
          <Button label="Write them for me" icon="create-outline" variant="secondary" compact loading={drafting} onPress={draft} />
        </View>
        <TextField label="Tagline" value={form.tagline} onChangeText={(tagline) => patch({ tagline })} maxLength={80} placeholder="Fresh stock every morning" />
        <TextField label="Tagline in Tamil" value={form.taglineTa} onChangeText={(taglineTa) => patch({ taglineTa })} maxLength={80} />
        {form.highlights.map((h, i) => (
          <TextField key={i} label={`Highlight ${i + 1}`} value={h} maxLength={24} placeholder={i === 0 ? "Fresh produce" : undefined}
            onChangeText={(t) => patch({ highlights: form.highlights.map((x, j) => (j === i ? t : x)) })} />
        ))}
      </View>
    </SectionCard>
  );
}

function Pictures({ form, patch }: { form: BrandingForm; patch: (p: Partial<BrandingForm>) => void }) {
  return (
    <SectionCard title="Logo & photos">
      <View style={styles.fields}>
        <ImageField label="Logo" hint="Any shape. We trim the empty edges." value={form.logoUrl} onChange={(logoUrl) => patch({ logoUrl })} aspect={2} contain upload={uploadLogo} />
        <ImageField label="Cover photo" hint="A wide photo of your shop front" value={form.imageUrl} onChange={(imageUrl) => patch({ imageUrl })} aspect={2} />
        <Text style={[fieldStyles.label, styles.postersLabel]}>Posters</Text>
        <View style={styles.posters}>
          {form.promoImages.map((p, i) => (
            <View key={i} style={styles.poster}>
              <ImageField value={p} aspect={0.75} onChange={(url) => patch({ promoImages: form.promoImages.map((x, j) => (j === i ? url : x)) })} />
            </View>
          ))}
        </View>
        <TextField label="Brand colour" value={form.brandColor} onChangeText={(brandColor) => patch({ brandColor })} placeholder="#0f766e" autoCapitalize="none" maxLength={7}
          error={form.brandColor && !HEX.test(form.brandColor) ? "Use a colour like #f97316" : undefined}
          leading={<View style={[styles.swatch, { backgroundColor: HEX.test(form.brandColor) ? form.brandColor : manage.hairline }]} />} />
      </View>
    </SectionCard>
  );
}

/** What shoppers see on the store card and at the top of the app: logo, photos, tagline, highlights and colour */
export default function BrandingScreen() {
  const { storeId, ai } = useLocalSearchParams<{ storeId: string; ai?: string }>();
  const router = useRouter();
  const { store, form, patch, draft, drafting, submit, saving } = useBranding(storeId, ai === "1");
  const save = async () => { if (await submit()) router.back(); };
  const invalid = !!form?.brandColor && !HEX.test(form.brandColor);
  return (
    <ManageStackScreen title="Shop branding" loading={store.loading || !form} error={store.error} onRetry={store.reload}
      actions={<Button label="Save" icon="checkmark" onPress={save} loading={saving} disabled={invalid || drafting} />}>
      {form && <Words form={form} patch={patch} draft={draft} drafting={drafting} />}
      {form && <Pictures form={form} patch={patch} />}
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 14 },
  ai: { backgroundColor: manage.tint, borderRadius: radius.lg, padding: 12, gap: 10 },
  aiText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.text },
  postersLabel: { marginBottom: -6 },
  posters: { flexDirection: "row", gap: 10 },
  poster: { flex: 1 },
  swatch: { width: 22, height: 22, borderRadius: 6, marginLeft: 12 },
});
