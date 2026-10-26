import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, fonts, radius } from "../../../constants/theme";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useToast } from "../../../lib/toast-context";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { Button } from "../../../components/manage/ui/Button";
import { ListRow } from "../../../components/manage/ui/ListRow";
import { SectionCard } from "../../../components/manage/ui/SectionCard";
import { TextField } from "../../../components/manage/ui/TextField";
import { formatINR, manage } from "../../../components/manage/ui/tokens";
import { DiscountFields } from "../../../components/manage/inventory/DiscountFields";
import { OfferFields } from "../../../components/manage/inventory/OfferFields";
import { OfferKindPicker } from "../../../components/manage/offers/OfferKindPicker";
import { ListingPickerSheet, type PickedListing } from "../../../components/manage/offers/ListingPickerSheet";
import { EMPTY_OFFER, offerBody, type NewOfferDraft } from "../../../components/manage/offers/offer-draft";

function Terms({ draft, patch }: { draft: NewOfferDraft; patch: (p: Partial<NewOfferDraft>) => void }) {
  if (draft.kind === "BUY_GET") return <OfferFields draft={draft} onChange={patch} />;
  if (draft.kind === "DISCOUNT") return <DiscountFields draft={draft} onChange={patch} withDates />;
  return (
    <TextField
      label="% below the selling price"
      value={draft.memberPercent}
      onChangeText={(t) => patch({ memberPercent: t.replace(/[^0-9]/g, "").slice(0, 2) })}
      keyboardType="number-pad"
      suffix="%"
      hint="Each size's member price is its price less this, rounded down to the rupee"
    />
  );
}

interface OfferPicks {
  buyGet: { buy: number; get: number; listings: PickedListing[] };
  discount: { discountType: "PERCENTAGE"; discountValue: number; listings: PickedListing[] };
}

// With `ai`, the form opens on well-stocked products that haven't sold lately, with terms to suit; the owner edits and starts it
function useAiPicks(storeId: string, kind: string | undefined, apply: (draft: Partial<NewOfferDraft>, picked: PickedListing[]) => void) {
  const { run } = useAction();
  const [picked, setPicked] = useState<boolean | null>(kind ? null : false);
  useEffect(() => {
    if (!kind) return;
    void run(() => api.post<OfferPicks>("/api/v1/storefront/ai/offer-picks", { storeId })).then((res) => {
      if (!res) return setPicked(false);
      const { buyGet, discount } = res.data;
      if (kind === "DISCOUNT") apply({ kind: "DISCOUNT", discountMode: discount.discountType, discountValue: String(discount.discountValue) }, discount.listings);
      else apply({ kind: "BUY_GET", offerMode: "B2G1", offerBuy: String(buyGet.buy), offerGet: String(buyGet.get) }, buyGet.listings);
      setPicked(true);
    });
  }, [kind, storeId, run]); // eslint-disable-line react-hooks/exhaustive-deps
  return picked;
}

/** One offer on many products: pick the kind and its terms, the products, then start it */
export default function NewOfferScreen() {
  const { storeId, ai } = useLocalSearchParams<{ storeId: string; ai?: string }>();
  const router = useRouter();
  const toast = useToast();
  const { run, running } = useAction();
  const [draft, setDraft] = useState<NewOfferDraft>(EMPTY_OFFER);
  const [picked, setPicked] = useState<PickedListing[]>([]);
  const [picking, setPicking] = useState(false);
  const patch = (p: Partial<NewOfferDraft>) => setDraft((d) => ({ ...d, ...p }));
  const aiPicked = useAiPicks(storeId, ai, (p, listings) => { patch(p); setPicked(listings); });
  const toggle = (l: PickedListing) => setPicked((all) => (all.some((p) => p.id === l.id) ? all.filter((p) => p.id !== l.id) : [...all, l]));

  const save = async () => {
    const body = offerBody(draft, storeId, picked);
    if (typeof body === "string") return toast.show(body, "error");
    const res = await run(() => api.post<{ updated: number }>("/api/v1/offers", body), "Offer started");
    if (res) router.back();
  };

  return (
    <ManageStackScreen title="New offer" loading={aiPicked === null} actions={<Button label="Start offer" icon="flash-outline" onPress={save} loading={running} style={styles.save} />}>
      {aiPicked && <Text style={styles.aiNote}>These products have stock but haven't sold in 30 days. Remove any you'd rather not put on offer.</Text>}
      <OfferKindPicker value={draft.kind} onChange={(kind) => patch({ kind })} />
      <SectionCard title="Terms">
        <View style={styles.fields}><Terms draft={draft} patch={patch} /></View>
      </SectionCard>
      <SectionCard title={`Products (${picked.length})`} flush>
        {picked.map((p) => (
          <ListRow
            key={p.id}
            title={p.name}
            subtitle={`${p.size} · ${formatINR(p.price, { decimals: true })}`}
            imageUrl={p.imageUrl}
            trailing={
              <TouchableOpacity style={styles.remove} onPress={() => toggle(p)} accessibilityLabel={`Remove ${p.name} ${p.size}`}>
                <Ionicons name="close-circle-outline" size={22} color={colors.error} />
              </TouchableOpacity>
            }
          />
        ))}
        <View style={styles.add}><Button label="Pick products" icon="add" variant="secondary" onPress={() => setPicking(true)} /></View>
      </SectionCard>
      <ListingPickerSheet visible={picking} storeId={storeId} picked={picked} onToggle={toggle} onClose={() => setPicking(false)} />
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  aiNote: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 19, color: colors.text, backgroundColor: manage.tint, borderRadius: radius.lg, padding: 12 },
  fields: { gap: 12 },
  save: { flex: 1 },
  remove: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  add: { padding: 12 },
});
