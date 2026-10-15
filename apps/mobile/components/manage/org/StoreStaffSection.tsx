import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../constants/theme";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useResource } from "../../../lib/manage/use-resource";
import { manage } from "../ui/tokens";
import { SectionCard } from "../ui/SectionCard";
import { StatusPill } from "../ui/StatusPill";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { UserPickerSheet } from "./UserPickerSheet";
import { ROLE_PILL } from "./constants";
import type { StaffAssignment, UserRow } from "./types";

function StaffRow({ item, onRemove }: { item: StaffAssignment; onRemove: () => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{item.user.name}</Text>
        <Text style={styles.email} numberOfLines={1}>{item.user.email}</Text>
        <View style={styles.pill}><StatusPill {...ROLE_PILL[item.user.role]} /></View>
      </View>
      <TouchableOpacity style={styles.remove} onPress={onRemove} accessibilityLabel={`Remove ${item.user.name}`}>
        <Ionicons name="close-circle-outline" size={22} color={colors.error} />
      </TouchableOpacity>
    </View>
  );
}

/** Staff assigned to one store: assign an existing user, remove with confirmation */
export function StoreStaffSection({ storeId }: { storeId: string }) {
  const staff = useResource<StaffAssignment[]>(`/api/v1/stores/${storeId}/staff`);
  const { run, running } = useAction();
  const [picking, setPicking] = useState(false);
  const [removing, setRemoving] = useState<StaffAssignment | null>(null);
  const items = staff.data ?? [];

  const assign = async (user: UserRow) => {
    const done = await run(() => api.post(`/api/v1/stores/${storeId}/staff`, { userId: user.id }), `${user.name} assigned`);
    if (done) {
      setPicking(false);
      staff.reload();
    }
  };

  const remove = async () => {
    if (!removing) return;
    const done = await run(() => api.delete(`/api/v1/stores/${storeId}/staff/${removing.userId}`), "Removed from store");
    setRemoving(null);
    if (done) staff.reload();
  };

  return (
    <SectionCard title={`Store staff (${items.length})`}>
      {staff.error ? <Text style={styles.empty}>{staff.error}</Text> : null}
      {!staff.error && !staff.loading && items.length === 0 ? <Text style={styles.empty}>No one is assigned to this store yet.</Text> : null}
      {items.map((item) => <StaffRow key={item.id} item={item} onRemove={() => setRemoving(item)} />)}
      <Button label="Assign user" variant="secondary" icon="person-add-outline" onPress={() => setPicking(true)} loading={running && picking} style={styles.assign} />
      <UserPickerSheet visible={picking} excludeIds={items.map((i) => i.userId)} onClose={() => setPicking(false)} onPick={assign} />
      <ConfirmDialog
        visible={!!removing}
        title="Remove from store?"
        message={`${removing?.user.name ?? "This user"} will lose access to this store.`}
        confirmLabel="Remove"
        running={running}
        onConfirm={remove}
        onClose={() => setRemoving(null)}
      />
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: manage.hairline },
  body: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  email: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  pill: { marginTop: 6 },
  remove: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  empty: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary, paddingVertical: 8 },
  assign: { marginTop: 12 },
});
