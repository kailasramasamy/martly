import { useCallback, useState } from "react";
import { ActivityIndicator, Animated, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { CreateStorePostInput, UpdateStorePostInput } from "@martly/shared/schemas";
import type { VoiceTranslations } from "@martly/shared/types";
import { colors, fonts } from "../../../constants/theme";
import { api } from "../../../lib/api";
import { formatDate } from "../../../lib/i18n/format";
import { useAction } from "../../../lib/manage/use-action";
import { useToast } from "../../../lib/toast-context";
import { useCloudVoice } from "../../../lib/use-cloud-voice";
import { ManageStackScreen } from "../ManageStackScreen";
import { Button } from "../ui/Button";
import { SectionCard } from "../ui/SectionCard";
import { SegmentedTabs } from "../ui/SegmentedTabs";
import { SwitchRow } from "../ui/SwitchRow";
import { TextField } from "../ui/TextField";
import { TagProductsSheet, type TaggedProduct } from "./TagProductsSheet";
import { TranslationPreview, useTranslationPreview } from "./TranslationPreview";
import { describeAudience } from "@martly/shared/store-voice";
import { usePostAudience } from "./use-post-audience";

type Kind = CreateStorePostInput["kind"];
// "keep": an edit leaves the end date as it is
type Days = "0" | "3" | "7" | "keep";

/** A post opened for editing, with every product it tags */
export interface EditablePost {
  id: string;
  kind: Kind;
  text: string;
  expiresAt: string;
  translations: VoiceTranslations | null;
  products: TaggedProduct[];
}

const KINDS: { value: Kind; label: string }[] = [
  { value: "FRESH_TODAY", label: "Fresh today" },
  { value: "NEW_IN_STORE", label: "New in store" },
  { value: "BACK_IN_STOCK", label: "Back in stock" },
];
const DAYS: { value: Days; label: string }[] = [{ value: "0", label: "Today only" }, { value: "3", label: "3 days" }, { value: "7", label: "7 days" }];
const endsOn = (iso: string) => `Ends ${formatDate(iso, { day: "numeric", month: "short" })}`;
// What each kind lasts unless the owner says otherwise: fresh stock is today's news, new arrivals a week
const KIND_DAYS: Record<Kind, Days> = { FRESH_TODAY: "0", BACK_IN_STOCK: "3", NEW_IN_STORE: "7" };
const MAX_PRODUCTS = 6;

/** A new post's starting point, e.g. an AI draft the owner reviews */
export type PostSeed = Omit<EditablePost, "id" | "expiresAt">;

// What the owner says, typed or spoken (Tamil, English or both); each spoken sentence is added to the text
function useSayIt(storeId: string, initial: string) {
  const [text, setText] = useState(initial);
  const append = useCallback((said: string) => setText((prev) => (prev.trim() ? `${prev.trim()} ${said}` : said)), []);
  const voice = useCloudVoice(() => {}, append, { storeId, continuous: true, purpose: "post" });
  return { text, setText, voice };
}

// Under the text while speaking: listening (the dot pulses with the voice), then writing down what was said
export function VoiceStatus({ listening, pending, level }: { listening: boolean; pending: number; level: Animated.Value | null }) {
  if (!listening && pending === 0) return null;
  const pulse = level ? { opacity: level.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }), transform: [{ scale: level.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }] } : null;
  return (
    <View style={styles.status} accessibilityLiveRegion="polite">
      {listening ? <Animated.View style={[styles.dot, pulse]} /> : <ActivityIndicator size="small" color={colors.primary} />}
      <Text style={styles.statusText}>
        {listening ? "Listening… tap Done when you've finished" : pending > 1 ? `Writing down what you said (${pending} parts)…` : "Writing down what you said…"}
      </Text>
    </View>
  );
}

function Tagged({ products, onRemove }: { products: TaggedProduct[]; onRemove: (p: TaggedProduct) => void }) {
  return (
    <View style={styles.chips}>
      {products.map((p) => (
        <View key={p.id} style={styles.chip}>
          {p.imageUrl && <Image source={{ uri: p.imageUrl }} style={styles.chipImg} />}
          <Text style={styles.chipText} numberOfLines={1}>{p.name}</Text>
          <TouchableOpacity onPress={() => onRemove(p)} hitSlop={8} accessibilityLabel={`Remove ${p.name}`}>
            <Ionicons name="close" size={16} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

// The post being written or edited, and saving it: kind, how long it shows, tagged products and whether to notify.
// An edit starts from the post as it is, keeps its end date, and doesn't notify unless asked
function usePostDraft(storeId: string, existing: EditablePost | undefined, seed: PostSeed | undefined) {
  const router = useRouter();
  const toast = useToast();
  const { run, running } = useAction();
  const start = existing ?? seed;
  const say = useSayIt(storeId, start?.text ?? "");
  const translation = useTranslationPreview(say.text, say.voice.listening || say.voice.pending > 0, start?.translations);
  const [kind, setKind] = useState<Kind>(start?.kind ?? "FRESH_TODAY");
  const [days, setDays] = useState<Days>(existing ? "keep" : KIND_DAYS[start?.kind ?? "FRESH_TODAY"]);
  const [products, setProducts] = useState<TaggedProduct[]>(start?.products ?? []);
  const [notify, setNotify] = useState(!existing);
  const pickKind = (k: Kind) => { setKind(k); if (!existing) setDays(KIND_DAYS[k]); };
  const toggle = (p: TaggedProduct) => setProducts((prev) =>
    (prev.some((x) => x.id === p.id) ? prev.filter((x) => x.id !== p.id) : prev.length < MAX_PRODUCTS ? [...prev, p] : prev));
  const post = async () => {
    const body: UpdateStorePostInput = {
      kind, text: say.text.trim(), productIds: products.map((p) => p.id), notify, translations: translation.translations,
      ...(days === "keep" ? {} : { days: Number(days) as 0 | 3 | 7 }),
    };
    const res = await run(() => (existing
      ? api.put<{ id: string; notified: boolean }>(`/api/v1/store-voice/posts/${existing.id}`, body)
      : api.post<{ id: string; notified: boolean }>("/api/v1/store-voice/posts", { ...body, storeId })));
    if (!res) return;
    const done = existing ? "Saved" : "Posted";
    toast.show(!notify ? done : res.data.notified ? `${done}, shoppers notified` : `${done}. Today's notification already went out`, "success");
    router.back();
  };
  return { say, translation, kind, pickKind, days, setDays, products, toggle, notify, setNotify, post, running };
}

/**
 * The owner's post to shoppers, new or opened for editing: what it's about, what they'd say at the counter, which
 * products, how long it shows and who hears it
 */
export function PostForm({ storeId, existing, seed }: { storeId: string; existing?: EditablePost; seed?: PostSeed }) {
  const { say, translation, kind, pickKind, days, setDays, products, toggle, notify, setNotify, post, running } = usePostDraft(storeId, existing, seed);
  const [tagging, setTagging] = useState(false);
  const audience = usePostAudience(storeId, kind, products.map((p) => p.id));
  const dayOptions = existing ? [{ value: "keep" as const, label: endsOn(existing.expiresAt) }, ...DAYS] : DAYS;

  const actions = <Button label={existing ? "Save" : "Post"} icon={existing ? "checkmark" : "megaphone-outline"} onPress={post} loading={running} disabled={!say.text.trim() || say.voice.listening || say.voice.pending > 0 || translation.loading} style={styles.post} />;
  return (
    <ManageStackScreen title={existing ? "Edit post" : "Post to shoppers"} actions={actions}>
      <SectionCard title="What's it about">
        <SegmentedTabs options={KINDS} value={kind} onChange={pickKind} />
      </SectionCard>
      <SectionCard title="Say it like you would at the counter">
        <TextField
          label="Post" value={say.text} onChangeText={say.setText} multiline maxLength={400}
          placeholder="Ooty carrots came in this morning…" hint="Tamil or English. We'll write it in the other language below."
        />
        <VoiceStatus listening={say.voice.listening} pending={say.voice.pending} level={say.voice.level} />
        {say.voice.available && (
          <Button
            label={say.voice.listening ? "Done speaking" : "Speak instead"} icon={say.voice.listening ? "stop-circle-outline" : "mic-outline"}
            variant="secondary" compact onPress={say.voice.listening ? say.voice.stop : say.voice.start}
          />
        )}
        <TranslationPreview preview={translation} hasText={!!say.text.trim()} />
      </SectionCard>
      <SectionCard title={`Products in the post · ${products.length} of ${MAX_PRODUCTS}`}>
        <Tagged products={products} onRemove={toggle} />
        <Button label="Tag products" icon="add" variant="secondary" compact onPress={() => setTagging(true)} />
      </SectionCard>
      <SectionCard title="Who sees it">
        <View style={styles.pills}><SegmentedTabs options={dayOptions} value={days} onChange={setDays} /></View>
        <SwitchRow
          label="Notify shoppers" value={notify} onValueChange={setNotify}
          description={describeAudience(audience)}
        />
      </SectionCard>
      <TagProductsSheet visible={tagging} storeId={storeId} tagged={products} onToggle={toggle} onClose={() => setTagging(false)} />
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  post: { flex: 1 },
  pills: { marginBottom: 16 },
  status: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 40, marginBottom: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#f0fdfa" },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#dc2626" },
  statusText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: "#115e59" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%", height: 40, paddingLeft: 4, paddingRight: 10, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: "#ffffff" },
  chipImg: { width: 30, height: 30, resizeMode: "contain" },
  chipText: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 13, color: colors.text },
});
