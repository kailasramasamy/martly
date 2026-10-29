import { useCallback, useState } from "react";
import { Text, View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ManageStackScreen } from "../ManageStackScreen";
import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { Button } from "../ui/Button";
import { VoiceStatus } from "../store-voice/PostForm";
import { colors, fonts } from "../../../constants/theme";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useManageScope } from "../../../lib/manage-scope-context";
import { useCloudVoice } from "../../../lib/use-cloud-voice";
import { NoPromotionsLeft } from "./PromoCreateParts";
import { PlanLimitNotice, usePlanLimit } from "./PlanLimit";
import { promotionsLeft, useEntitlements } from "./use-entitlements";

const BRIEF_MAX = 200;
const PLACEHOLDER = 'e.g. "Diwali sweets 10% off", "fresh fruits", "ghee products"';
const HINT = "Type it or say it in English or தமிழ். Martly makes the banner, picks the products and puts it live in a few minutes. Your customers get a notification.";

// What the owner says, typed or spoken (English or Tamil); each spoken sentence is added to the text
function useBrief(storeId: string | undefined) {
  const [brief, setBrief] = useState("");
  const append = useCallback((said: string) => setBrief((prev) => `${prev.trim()} ${said}`.trim().slice(0, BRIEF_MAX)), []);
  const voice = useCloudVoice(() => {}, append, { storeId, continuous: true, purpose: "post" });
  return { brief, setBrief, voice };
}

/** A store owner's promotion: say what to promote and Martly builds it and puts it live */
export function PromoRequestForm() {
  const router = useRouter();
  const { stores } = useManageScope();
  const { data: entitlements } = useEntitlements();
  const { run, running } = useAction();
  const limit = usePlanLimit();
  const { brief, setBrief, voice } = useBrief(stores.find((s) => s.status === "ACTIVE")?.id);
  const [error, setError] = useState<string | null>(null);
  const left = entitlements ? promotionsLeft(entitlements) : null;
  const outOfPromos = left === 0;
  const speaking = voice.listening || voice.pending > 0;

  const submit = async () => {
    if (brief.trim().length < 3) return setError("Enter at least 3 characters");
    setError(null);
    const res = await run(() => limit.capture(() => api.post<{ id: string }>("/api/v1/promos", { brief: brief.trim() })));
    if (res) router.replace(`/manage/promos/${res.data.id}`);
  };

  const actions = (
    <View style={styles.bar}>
      <Button label="Start promotion" icon="rocket-outline" onPress={submit} loading={running} disabled={outOfPromos || speaking} />
      {left !== null && !outOfPromos ? <Text style={styles.uses}>{`Uses 1 of your ${left} promotion${left === 1 ? "" : "s"} left`}</Text> : null}
    </View>
  );
  return (
    <ManageStackScreen title="New promotion" actions={actions}>
      {outOfPromos ? <NoPromotionsLeft /> : null}
      <SectionCard>
        <TextField label="What do you want to promote?" required value={brief} onChangeText={setBrief} multiline maxLength={BRIEF_MAX} placeholder={PLACEHOLDER} error={error} hint={HINT} />
        <VoiceStatus listening={voice.listening} pending={voice.pending} level={voice.level} />
        {voice.available && (
          <Button
            label={voice.listening ? "Done speaking" : "Speak instead"} icon={voice.listening ? "stop-circle-outline" : "mic-outline"}
            variant="secondary" compact onPress={voice.listening ? voice.stop : voice.start}
          />
        )}
      </SectionCard>
      <PlanLimitNotice message={limit.message} />
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  bar: { flex: 1, gap: 6 },
  uses: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, textAlign: "center" },
});
