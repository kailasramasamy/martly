import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { can } from "@martly/shared/permissions";
import { colors, fonts } from "../../../constants/theme";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { useAction } from "../../../lib/manage/use-action";
import { useResource } from "../../../lib/manage/use-resource";
import { useStoreScope } from "../StoreScope";
import { Button } from "../ui/Button";
import { SectionCard } from "../ui/SectionCard";
import { SwitchRow } from "../ui/SwitchRow";
import { TextField } from "../ui/TextField";

interface AislePicks {
  aisle: string | null;
  limit: number;
  picks: { id: string; productId: string; note: string; product: { name: string; imageUrl: string | null } }[];
}

const STARTERS = ["We use it at home", "Best value here", "Fresh every week", "Customers come back for it"];

// The aisle's picks at the store, and saving or removing this product's
function usePicks(storeId: string, productId: string) {
  const { run, running } = useAction();
  const { data, reload } = useResource<AislePicks>(`/api/v1/store-voice/picks?storeId=${storeId}&productId=${productId}`);
  const save = (note: string) => run(() => api.put("/api/v1/store-voice/picks", { storeId, productId, note }), "Saved as your pick").then(() => reload());
  const remove = (id: string) => run(() => api.delete(`/api/v1/store-voice/picks?storeId=${storeId}&productId=${id}`), "Pick removed").then(() => reload());
  return { data, save, remove, running };
}

function OtherPicks({ data, productId, onRemove }: { data: AislePicks; productId: string; onRemove: (id: string) => void }) {
  return (
    <View style={styles.others}>
      <Text style={styles.othersTitle}>{`Your picks in ${data.aisle ?? "this aisle"} · ${data.picks.length} of ${data.limit}`}</Text>
      {data.picks.map((p) => (
        <View key={p.id} style={styles.pick}>
          {p.product.imageUrl && <Image source={{ uri: p.product.imageUrl }} style={styles.pickImg} />}
          <Text style={styles.pickName} numberOfLines={1}>{p.product.name}</Text>
          {p.productId === productId
            ? <Text style={styles.thisOne}>THIS ONE</Text>
            : <Button label="Remove" variant="secondary" compact onPress={() => onRemove(p.productId)} />}
        </View>
      ))}
    </View>
  );
}

/** "I recommend this" on a product, for one store: why in a line, and the aisle's other picks (3 at most) */
export function OwnerPickSection({ productId }: { productId: string }) {
  const { user } = useAuth();
  const { storeId, picker } = useStoreScope({ placeholder: "Pick a store" });
  if (!can(user, "store-posts", "edit")) return null;
  return (
    <SectionCard title="Owner's pick">
      {picker}
      {storeId && <PickEditor storeId={storeId} productId={productId} />}
    </SectionCard>
  );
}

function PickEditor({ storeId, productId }: { storeId: string; productId: string }) {
  const { data, save, remove, running } = usePicks(storeId, productId);
  const mine = data?.picks.find((p) => p.productId === productId);
  const [on, setOn] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => { setOn(!!mine); setNote(mine?.note ?? ""); }, [mine?.id, mine?.note]);
  const full = !!data && !mine && data.picks.length >= data.limit;
  const toggle = (value: boolean) => (value ? setOn(true) : mine ? void remove(productId) : setOn(false));
  return (
    <>
      <SwitchRow
        label="I recommend this" value={on} onValueChange={toggle} disabled={full}
        description={full ? `${data!.limit} picks in this aisle already. Remove one to pick this.` : "Shows \"Owner's pick\" on the product, in its aisle and in search"}
      />
      {on && (
        <>
          <TextField label="Why, in a line" value={note} onChangeText={setNote} maxLength={90} placeholder="We cook with this at home" />
          <View style={styles.starters}>
            {STARTERS.map((s) => (
              <TouchableOpacity key={s} style={styles.starter} onPress={() => setNote(s)} accessibilityRole="button">
                <Text style={styles.starterText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Button label="Save pick" onPress={() => save(note.trim())} loading={running} disabled={!note.trim() || note.trim() === mine?.note} />
        </>
      )}
      {data && data.picks.length > 0 && <OtherPicks data={data} productId={productId} onRemove={(id) => void remove(id)} />}
    </>
  );
}

const styles = StyleSheet.create({
  starters: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 10 },
  starter: { minHeight: 36, justifyContent: "center", paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  starterText: { fontFamily: fonts.bold, fontSize: 12.5, color: "#334155" },
  others: { marginTop: 14, gap: 6 },
  othersTitle: { fontFamily: fonts.extrabold, fontSize: 12, letterSpacing: 0.3, color: "#475569" },
  pick: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52 },
  pickImg: { width: 36, height: 36, resizeMode: "contain" },
  pickName: { flex: 1, fontFamily: fonts.bold, fontSize: 13.5, color: colors.text },
  thisOne: { fontFamily: fonts.extrabold, fontSize: 11, color: colors.primary },
});
