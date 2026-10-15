import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { SubscriptionDeliveryModeLabels } from "@martly/shared/constants";
import { BottomSheet } from "../../search/BottomSheet";
import { SwitchRow } from "../ui/SwitchRow";
import { SelectField } from "../ui/SelectField";
import { TextField } from "../ui/TextField";
import { Button } from "../ui/Button";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import type { StoreSubscriptionConfig } from "./subscription-types";

const MODE_OPTIONS = Object.entries(SubscriptionDeliveryModeLabels).map(([value, label]) => ({ value, label }));
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

interface Props {
  store: StoreSubscriptionConfig | null;
  onClose: () => void;
  onSaved: (store: StoreSubscriptionConfig) => void;
}

export function StoreSubscriptionSheet({ store, onClose, onSaved }: Props) {
  return (
    <BottomSheet visible={!!store} title={store?.name ?? ""} onClose={onClose}>
      {store ? <StoreFields key={store.id} store={store} onSaved={onSaved} /> : null}
    </BottomSheet>
  );
}

function StoreFields({ store, onSaved }: { store: StoreSubscriptionConfig; onSaved: Props["onSaved"] }) {
  const { run, running } = useAction();
  const [enabled, setEnabled] = useState(store.subscriptionEnabled);
  const [mode, setMode] = useState<string>(store.subscriptionDeliveryMode);
  const [start, setStart] = useState(store.subscriptionWindowStart ?? "");
  const [end, setEnd] = useState(store.subscriptionWindowEnd ?? "");
  const [cutoff, setCutoff] = useState(store.subscriptionCutoffTime);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dedicated = mode === "DEDICATED";

  const save = async () => {
    const found: Record<string, string> = {};
    if (enabled && dedicated && !TIME.test(start)) found.start = "Use 24-hour HH:MM";
    if (enabled && dedicated && !TIME.test(end)) found.end = "Use 24-hour HH:MM";
    if (!TIME.test(cutoff)) found.cutoff = "Use 24-hour HH:MM";
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const body = {
      subscriptionEnabled: enabled, subscriptionDeliveryMode: mode,
      subscriptionWindowStart: dedicated ? start : null, subscriptionWindowEnd: dedicated ? end : null, subscriptionCutoffTime: cutoff,
    };
    const res = await run(() => api.patch<StoreSubscriptionConfig>(`/api/v1/subscriptions/config/store/${store.id}`, body), "Store config saved");
    if (res) onSaved(res.data);
  };

  return (
    <View style={styles.body}>
      <SwitchRow label="Subscriptions enabled" value={enabled} onValueChange={setEnabled} />
      {enabled ? (
        <>
          <SelectField label="Delivery mode" value={mode} options={MODE_OPTIONS} onChange={setMode} />
          {dedicated ? (
            <>
              <TextField label="Window start" value={start} onChangeText={setStart} placeholder="06:00" keyboardType="numbers-and-punctuation" error={errors.start} />
              <TextField label="Window end" value={end} onChangeText={setEnd} placeholder="09:00" keyboardType="numbers-and-punctuation" error={errors.end} />
            </>
          ) : null}
          <TextField label="Cutoff time" value={cutoff} onChangeText={setCutoff} placeholder="22:00" keyboardType="numbers-and-punctuation" hint="Orders placed after this time move to the next delivery day" error={errors.cutoff} />
        </>
      ) : null}
      <Button label="Save store config" onPress={save} loading={running} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingBottom: 16 },
});
