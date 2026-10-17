import { useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { BANNER_IMAGE_REQUIREMENTS } from "@martly/shared/constants";
import { SegmentedTabs } from "../ui/SegmentedTabs";
import { ImageField } from "../ui/ImageField";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { colors, fonts } from "../../../constants/theme";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { PlanLimitNotice, usePlanLimit } from "./PlanLimit";
import type { Entitlements } from "./plan-types";

const BANNER_ASPECT = 1.5;
const TABS = [{ value: "upload", label: "Upload" }, { value: "ai", label: "Generate with AI" }] as const;

export function UploadGuidance() {
  return (
    <View style={styles.guidance}>
      {BANNER_IMAGE_REQUIREMENTS.guidance.map((line) => <Text key={line} style={styles.bullet}>{`• ${line}`}</Text>)}
    </View>
  );
}

export interface GeneratedArt {
  imageUrl: string;
  textInImage: boolean;
}

interface Props {
  imageUrl: string | null;
  onImage: (url: string | null) => void;
  onGenerated: (art: GeneratedArt) => void;
  title: string;
  subtitle: string;
  /** Where the banner leads; pictured when the description is left empty */
  actionType: string;
  actionTarget: string;
  error?: string;
  entitlements: Entitlements | null;
}

/** Banner artwork: upload your own, or have the AI design it from the title (and an optional brief) */
export function ImageSource({ imageUrl, onImage, onGenerated, title, subtitle, actionType, actionTarget, error, entitlements }: Props) {
  const [mode, setMode] = useState<"upload" | "ai">("upload");
  const [brief, setBrief] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const { run, running } = useAction();
  const limit = usePlanLimit();
  const ai = entitlements?.aiImages;

  const generate = async () => {
    const name = title.trim();
    if (name.length < 2 || name.length > 40) return setTitleError("Add a title of 2 to 40 characters in Details first");
    setTitleError(null);
    const body = { title: name, subtitle: subtitle.trim() || undefined, brief: brief.trim() || undefined, actionType, actionTarget: actionTarget.trim() || undefined };
    const res = await run(() => limit.capture(() => api.post<GeneratedArt>("/api/v1/banners/generate-image", body)));
    if (res) onGenerated({ imageUrl: res.data.imageUrl, textInImage: res.data.textInImage });
  };

  return (
    <>
      <SegmentedTabs options={[...TABS]} value={mode} onChange={setMode} />
      {mode === "upload" ? <UploadGuidance /> : (
        <>
          <TextField label="What should the picture show?" value={brief} onChangeText={setBrief} multiline maxLength={400} placeholder="Optional; leave empty to picture the banner's target" hint={ai ? `AI images: ${ai.used} of ${ai.total} used this month` : undefined} error={titleError ?? undefined} />
          <Button label="Generate" icon="sparkles-outline" onPress={generate} loading={running} />
          {running ? <View style={styles.progress}><ActivityIndicator color={colors.primary} /><Text style={styles.bullet}>Designing your banner… up to a minute</Text></View> : null}
          <PlanLimitNotice message={limit.message} />
        </>
      )}
      <ImageField value={imageUrl} onChange={onImage} aspect={BANNER_ASPECT} error={error} hint="Recommended 3:2" />
    </>
  );
}

const styles = StyleSheet.create({
  guidance: { gap: 4 },
  bullet: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  progress: { flexDirection: "row", alignItems: "center", gap: 10 },
});
