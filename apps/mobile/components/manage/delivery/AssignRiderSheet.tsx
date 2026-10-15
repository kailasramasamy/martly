import { useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { BottomSheet } from "../../search/BottomSheet";
import { colors, fonts } from "../../../constants/theme";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useResource } from "../../../lib/manage/use-resource";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { ListRow } from "../ui/ListRow";
import type { RiderOption } from "./types";

interface AssignRiderSheetProps {
  visible: boolean;
  storeId: string;
  orderIds: string[];
  onClose: () => void;
  onCreated: () => void;
  onManageRiders: () => void;
}

export function AssignRiderSheet({ visible, storeId, orderIds, onClose, onCreated, onManageRiders }: AssignRiderSheetProps) {
  const riders = useResource<RiderOption[]>(visible ? `/api/v1/delivery-trips/riders?storeId=${storeId}` : null);
  const [riderId, setRiderId] = useState<string | null>(null);
  const { run, running } = useAction();

  const create = async () => {
    if (!riderId) return;
    const res = await run(() => api.post("/api/v1/delivery-trips", { storeId, riderId, orderIds }), "Trip created");
    if (res) {
      setRiderId(null);
      onCreated();
    }
  };

  const footer = (
    <View style={styles.footer}>
      <Button label={`Create trip · ${orderIds.length} order${orderIds.length === 1 ? "" : "s"}`} onPress={create} loading={running} disabled={!riderId} />
    </View>
  );

  return (
    <BottomSheet visible={visible} title="Assign rider" onClose={onClose} footer={footer}>
      {riders.loading ? <Text style={styles.note}>Loading riders…</Text> : null}
      {riders.error ? <EmptyState icon="cloud-offline-outline" title="Couldn't load riders" message={riders.error} action={{ label: "Try again", onPress: riders.reload }} /> : null}
      {riders.data && riders.data.length === 0 ? (
        <EmptyState icon="bicycle-outline" title="No riders at this store" action={{ label: "Add a rider", onPress: onManageRiders }} />
      ) : null}
      <ScrollView>
        {riders.data?.map((r) => (
          <ListRow key={r.id} icon="bicycle-outline" title={r.name} subtitle={r.phone ?? r.email} selected={r.id === riderId} onPress={() => setRiderId(r.id)} />
        ))}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, padding: 16 },
  footer: { paddingHorizontal: 16, paddingTop: 8 },
});
