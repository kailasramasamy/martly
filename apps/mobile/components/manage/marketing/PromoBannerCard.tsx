import { useState } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { Loader } from "../../Loader";
import { AI_IMAGE_COST } from "@martly/shared/constants";
import type { PromoDetail } from "@martly/shared/types";
import { SectionCard } from "../ui/SectionCard";
import { ImageField } from "../ui/ImageField";
import { TextField } from "../ui/TextField";
import { Button } from "../ui/Button";
import { manage } from "../ui/tokens";
import { colors, fonts, radius } from "../../../constants/theme";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { PlanLimitNotice, usePlanLimit } from "./PlanLimit";
import { AiImageUsage } from "./AiImageUsage";
import { BuyImagesSheet } from "./BuyImagesSheet";
import { aiImageLevel, useAiImageGate } from "./ai-images";
import { useEntitlements } from "./use-entitlements";

const BANNER_ASPECT = 1.5;
const COST = AI_IMAGE_COST.PROMO_BANNER;
const EDITABLE = ["READY", "LIVE"];

interface Props {
  promo: PromoDetail;
  onChange: (promo: PromoDetail) => void;
}

const previewUrl = (promo: PromoDetail) => promo.banner?.imageUrl ?? (promo.images ? Object.values(promo.images)[0] : null) ?? null;

/** The promotion's one home-carousel banner: its image, wording and results, with ways to replace the image or reword it */
export function PromoBannerCard({ promo, onChange }: Props) {
  const { data: entitlements, reload } = useEntitlements();
  const { run, running } = useAction();
  const limit = usePlanLimit();
  const gate = useAiImageGate();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [generating, setGenerating] = useState(false);
  const base = `/api/v1/promos/${promo.id}/banner`;
  const editable = EDITABLE.includes(promo.status);
  const imageUrl = previewUrl(promo);
  const shownTitle = promo.banner?.title ?? promo.title ?? "";
  const shownSubtitle = promo.banner?.subtitle ?? "";
  const out = !!entitlements && aiImageLevel(entitlements.aiImages, COST) === "out";

  const save = async (body: object, done: string) => {
    const res = await run(() => limit.capture(() => api.put<PromoDetail>(base, body)), done);
    if (res) onChange(res.data);
    return !!res;
  };
  const generate = async () => {
    setGenerating(true);
    const res = await run(() => limit.capture(() => gate.guard(() => api.post<PromoDetail>(`${base}/generate`, undefined))), "New banner ready");
    setGenerating(false);
    if (!res) return;
    onChange(res.data);
    reload();
  };
  const startEdit = () => {
    setTitle(shownTitle);
    setSubtitle(shownSubtitle);
    setEditing(true);
  };
  const saveWording = async () => {
    if (await save({ title: title.trim(), subtitle: subtitle.trim() }, "Wording updated")) setEditing(false);
  };

  return (
    <SectionCard title="Banner">
      {editable ? (
        <ImageField value={imageUrl} onChange={(url) => url && save({ imageUrl: url, textInImage: promo.banner?.textInImage ?? promo.textInImage }, "Banner updated")} aspect={BANNER_ASPECT} hint="Tap the banner to upload a new image" />
      ) : imageUrl ? <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" /> : null}
      <Text style={styles.title}>{shownTitle}</Text>
      {shownSubtitle ? <Text style={styles.stats}>{shownSubtitle}</Text> : null}
      {promo.banner ? <Text style={styles.stats}>{`${promo.banner.views.toLocaleString("en-IN")} views · ${promo.banner.taps.toLocaleString("en-IN")} taps`}</Text> : null}
      {editing ? (
        <View style={styles.form}>
          <TextField label="Banner title" value={title} onChangeText={setTitle} maxLength={60} />
          <TextField label="Banner subtitle" value={subtitle} onChangeText={setSubtitle} maxLength={90} />
          <View style={styles.row}>
            <Button label="Cancel" variant="secondary" onPress={() => setEditing(false)} style={styles.flex} />
            <Button label="Save" onPress={saveWording} loading={running} style={styles.flex} />
          </View>
        </View>
      ) : null}
      {editable && !editing ? (
        <View style={styles.row}>
          <Button label="Edit wording" icon="create-outline" variant="secondary" compact onPress={startEdit} style={styles.flex} />
          <Button label={out ? "Buy AI images" : "Generate new with AI"} icon={out ? "cart-outline" : "sparkles-outline"} variant="secondary" compact onPress={out ? gate.openBuy : generate} disabled={running} style={styles.flex} />
        </View>
      ) : null}
      {editable && !editing ? <View style={styles.usage}><AiImageUsage aiImages={entitlements?.aiImages} cost={COST} onBuy={gate.openBuy} /></View> : null}
      {generating ? <View style={styles.progress}><Loader /><Text style={styles.stats}>Designing your banner… up to a minute</Text></View> : null}
      <PlanLimitNotice message={limit.message} />
      <BuyImagesSheet visible={gate.buying} onClose={gate.closeBuy} onBought={reload} />
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  image: { width: "100%", aspectRatio: BANNER_ASPECT, borderRadius: radius.md, backgroundColor: manage.canvas },
  title: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text, marginTop: 8 },
  stats: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  form: { marginTop: 8 },
  row: { flexDirection: "row", gap: 10, marginTop: 10 },
  flex: { flex: 1 },
  usage: { marginTop: 8 },
  progress: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
});
