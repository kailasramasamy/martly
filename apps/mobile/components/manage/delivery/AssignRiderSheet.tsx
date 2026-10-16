import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { BottomSheet } from "../../search/BottomSheet";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { Button } from "../ui/Button";
import { RiderList } from "./RiderList";

interface AssignRiderSheetProps {
  visible: boolean;
  storeId: string;
  orderIds: string[];
  /** Send the orders out now instead of creating a trip to start later */
  start?: boolean;
  onClose: () => void;
  onCreated: () => void;
  onManageRiders: () => void;
}

export function AssignRiderSheet({ visible, storeId, orderIds, start, onClose, onCreated, onManageRiders }: AssignRiderSheetProps) {
  const [riderId, setRiderId] = useState<string | null>(null);
  const { run, running } = useAction();
  const count = `${orderIds.length} order${orderIds.length === 1 ? "" : "s"}`;

  const create = async () => {
    if (!riderId) return;
    const res = await run(() => api.post("/api/v1/delivery-trips", { storeId, riderId, orderIds, start }), start ? "Sent out for delivery" : "Trip created");
    if (res) {
      setRiderId(null);
      onCreated();
    }
  };

  const footer = (
    <View style={styles.footer}>
      <Button label={start ? `Send out · ${count}` : `Create trip · ${count}`} onPress={create} loading={running} disabled={!riderId} />
    </View>
  );

  return (
    <BottomSheet flush visible={visible} title={start ? "Send out with rider" : "Assign rider"} onClose={onClose} footer={footer}>
      {visible && <RiderList storeId={storeId} value={riderId} onChange={setRiderId} onManageRiders={onManageRiders} />}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  footer: { paddingHorizontal: 16, paddingTop: 8 },
});
