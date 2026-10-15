import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fonts } from "../../../constants/theme";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useToast } from "../../../lib/toast-context";
import { useManageScope } from "../../../lib/manage-scope-context";
import { useAuth } from "../../../lib/auth-context";
import { manage } from "../ui/tokens";
import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { SwitchRow } from "../ui/SwitchRow";
import { Button } from "../ui/Button";
import { FieldFrame } from "../ui/FieldFrame";
import { ManageStackScreen } from "../ManageStackScreen";
import { DeleteAction } from "./DeleteAction";
import { numberText, parseNumber } from "./numbers";
import type { DeliveryZone } from "./types";

const PINCODE = /^\d{6}$/;

function PincodeInput({ value, onChange }: { value: string[]; onChange: (codes: string[]) => void }) {
  const [text, setText] = useState("");
  const add = () => {
    const codes = text.split(/[\s,]+/).filter((c) => PINCODE.test(c) && !value.includes(c));
    if (codes.length) onChange([...value, ...codes]);
    setText("");
  };
  return (
    <FieldFrame label="Pincodes" hint="Type 6-digit pincodes separated by commas, then tap Add">
      <View style={styles.addRow}>
        <View style={styles.flex}><TextField value={text} onChangeText={setText} keyboardType="numbers-and-punctuation" placeholder="636701, 636702" /></View>
        <Button label="Add" variant="secondary" onPress={add} style={styles.addBtn} />
      </View>
      <View style={styles.tags}>
        {value.map((code) => (
          <TouchableOpacity key={code} style={styles.tag} onPress={() => onChange(value.filter((c) => c !== code))} accessibilityLabel={`Remove ${code}`}>
            <Text style={styles.tagText}>{code}</Text>
            <Ionicons name="close" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>
    </FieldFrame>
  );
}

function StoreToggles({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { stores } = useManageScope();
  return (
    <FieldFrame label="Serves stores">
      {stores.map((s) => (
        <SwitchRow key={s.id} label={s.name} value={value.includes(s.id)} onValueChange={(on) => onChange(on ? [...value, s.id] : value.filter((id) => id !== s.id))} />
      ))}
    </FieldFrame>
  );
}

function problem(name: string, fee: number | null, eta: number | null, orgId: string | undefined): string | null {
  if (!name.trim()) return "Zone name is required";
  if (fee === null || Number.isNaN(fee) || fee < 0) return "Enter a delivery fee (0 for free)";
  if (eta === null || !Number.isInteger(eta) || eta < 1) return "Estimated time must be a whole number of minutes";
  if (!orgId) return "Pick a store in the header first so we know the organization";
  return null;
}

export function ZoneForm({ zone }: { zone?: DeliveryZone }) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const { organizationId } = useManageScope();
  const { run, running } = useAction();
  const [name, setName] = useState(zone?.name ?? "");
  const [pincodes, setPincodes] = useState<string[]>(zone?.pincodes ?? []);
  const [fee, setFee] = useState(numberText(zone ? Number(zone.deliveryFee) : undefined));
  const [eta, setEta] = useState(numberText(zone?.estimatedMinutes ?? 60));
  const [storeIds, setStoreIds] = useState<string[]>(zone?.stores.map((s) => s.store.id) ?? []);
  const [isActive, setIsActive] = useState(zone?.isActive ?? true);
  const save = async () => {
    const deliveryFee = parseNumber(fee);
    const estimatedMinutes = parseNumber(eta);
    const orgId = zone?.organizationId ?? organizationId ?? user?.organizationId;
    const invalid = problem(name, deliveryFee, estimatedMinutes, orgId);
    if (invalid || !orgId) return toast.show(invalid ?? "Missing organization", "error");
    const fields = { name: name.trim(), pincodes, deliveryFee, estimatedMinutes, isActive, storeIds };
    const done = await run(
      () => (zone ? api.put(`/api/v1/delivery-zones/${zone.id}`, fields) : api.post("/api/v1/delivery-zones", { ...fields, organizationId: orgId })),
      zone ? "Zone updated" : "Zone created",
    );
    if (done) router.back();
  };
  const remove = async () => {
    if (!zone) return;
    const done = await run(() => api.delete(`/api/v1/delivery-zones/${zone.id}`), "Zone deleted");
    if (done) router.back();
  };
  return (
    <ManageStackScreen title={zone ? "Edit delivery zone" : "New delivery zone"} actions={<Button label={zone ? "Save changes" : "Create zone"} onPress={save} loading={running} style={styles.flex} />}>
      <SectionCard title="Zone">
        <TextField label="Zone name" required value={name} onChangeText={setName} />
        <PincodeInput value={pincodes} onChange={setPincodes} />
      </SectionCard>
      <SectionCard title="Charge">
        <TextField label="Delivery fee" required prefix={"₹"} keyboardType="decimal-pad" value={fee} onChangeText={setFee} />
        <TextField label="Estimated delivery time" required suffix="min" keyboardType="number-pad" value={eta} onChangeText={setEta} />
        <SwitchRow label="Active" value={isActive} onValueChange={setIsActive} />
      </SectionCard>
      <SectionCard title="Stores"><StoreToggles value={storeIds} onChange={setStoreIds} /></SectionCard>
      {zone && (
        <SectionCard title="Danger zone">
          <DeleteAction title="Delete this zone?" message="Stores linked to it will stop using these pincodes." loading={running} onConfirm={remove} />
        </SectionCard>
      )}
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  addRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  addBtn: { marginTop: 0, paddingHorizontal: 18 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  tag: { flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: manage.tint },
  tagText: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
});
