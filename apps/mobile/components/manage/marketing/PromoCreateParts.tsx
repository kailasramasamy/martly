import { Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { SectionCard } from "../ui/SectionCard";
import { SegmentedTabs } from "../ui/SegmentedTabs";
import { ImageField } from "../ui/ImageField";
import { SwitchRow } from "../ui/SwitchRow";
import { Button } from "../ui/Button";
import { colors, fonts } from "../../../constants/theme";
import { UploadGuidance } from "./ImageSource";

export type ImageMode = "ai" | "upload";
const IMAGE_TABS = [{ value: "ai", label: "Let AI design it" }, { value: "upload", label: "Upload my own" }] as const;
const BANNER_ASPECT = 1.5;

interface ImageChoiceProps {
  mode: ImageMode;
  onMode: (mode: ImageMode) => void;
  imageUrl: string | null;
  onImage: (url: string | null) => void;
  error?: string;
}

export function PromoImageChoice({ mode, onMode, imageUrl, onImage, error }: ImageChoiceProps) {
  return (
    <SectionCard title="Banner">
      <SegmentedTabs options={[...IMAGE_TABS]} value={mode} onChange={onMode} />
      {mode === "ai" ? (
        <Text style={styles.note}>The AI paints the banner from your brief.</Text>
      ) : (
        <>
          <UploadGuidance />
          <ImageField value={imageUrl} onChange={onImage} aspect={BANNER_ASPECT} error={error} hint="Recommended 3:2" />
        </>
      )}
    </SectionCard>
  );
}

interface OptionsProps {
  autoLaunch: boolean;
  onAutoLaunch: (v: boolean) => void;
  notify: boolean;
  onNotify: (v: boolean) => void;
  pushAllowed: boolean;
}

export function PromoOptions({ autoLaunch, onAutoLaunch, notify, onNotify, pushAllowed }: OptionsProps) {
  return (
    <SectionCard title="Options">
      <SwitchRow label="Launch automatically" description="Skips the review step" value={autoLaunch} onValueChange={onAutoLaunch} />
      <SwitchRow
        label="Notify customers"
        description={pushAllowed ? "One push per day at most" : "Push notifications come with Pro"}
        value={pushAllowed && notify}
        onValueChange={onNotify}
        disabled={!pushAllowed}
      />
    </SectionCard>
  );
}

export function NoPromotionsLeft() {
  const router = useRouter();
  return (
    <SectionCard title="No promotions left">
      <Text style={styles.note}>You've used this month's promotions. Upgrade your plan or buy extra promotions to create more.</Text>
      <Button label="Open Marketing plan" variant="secondary" onPress={() => router.push("/manage/marketing-plan")} style={styles.upsell} />
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  upsell: { marginTop: 12 },
});
