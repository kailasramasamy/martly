import { useState, type ReactNode } from "react";
import { StyleSheet } from "react-native";
import { Loader } from "../../Loader";
import { colors } from "../../../constants/theme";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useToast } from "../../../lib/toast-context";
import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { SwitchRow } from "../ui/SwitchRow";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { ManageStackScreen } from "../ManageStackScreen";
import { TimeSelect } from "./TimeSelect";
import { numberText, parseNumber } from "./numbers";
import type { ExpressConfig } from "./types";

interface ExpressFormProps {
  storeId: string;
  storeField: ReactNode;
  config: ExpressConfig | null;
  loading: boolean;
  error: string | null;
  onReload: () => void;
}

function LoadGate({ loading, error, onReload, children }: Pick<ExpressFormProps, "loading" | "error" | "onReload"> & { children: ReactNode }) {
  if (loading) return <Loader style={styles.loading} />;
  if (error) return <EmptyState icon="cloud-offline-outline" title="Couldn't load" message={error} action={{ label: "Try again", onPress: onReload }} />;
  return <>{children}</>;
}

/** With no saved row, express is on with default behaviour, so the form starts enabled */
export function ExpressForm({ storeId, storeField, config, loading, error, onReload }: ExpressFormProps) {
  const toast = useToast();
  const { run, running } = useAction();
  const [isEnabled, setIsEnabled] = useState(config?.isEnabled ?? true);
  const [eta, setEta] = useState(numberText(config?.etaMinutes));
  const [start, setStart] = useState<string | null>(config?.operatingStart ?? null);
  const [end, setEnd] = useState<string | null>(config?.operatingEnd ?? null);

  const save = async () => {
    const etaMinutes = parseNumber(eta);
    if (etaMinutes !== null && (!Number.isInteger(etaMinutes) || etaMinutes < 1 || etaMinutes > 300)) {
      return toast.show("ETA must be a whole number between 1 and 300 minutes", "error");
    }
    if ((start === null) !== (end === null)) return toast.show("Set both start and end time, or leave both empty", "error");
    const body = { isEnabled, etaMinutes, operatingStart: start, operatingEnd: end };
    const saved = await run(() => api.put<ExpressConfig>(`/api/v1/express-delivery/config?storeId=${storeId}`, body), "Express delivery config saved");
    if (saved) onReload();
  };

  const saveButton = <Button label={config ? "Update config" : "Save config"} onPress={save} loading={running} disabled={loading || !!error} style={styles.flex} />;
  return (
    <ManageStackScreen title="Express delivery" actions={saveButton}>
      <SectionCard>{storeField}</SectionCard>
      <LoadGate loading={loading} error={error} onReload={onReload}>
        <SectionCard title="Availability">
          <SwitchRow label="Enable express delivery" description="When off, customers only see scheduled slots" value={isEnabled} onValueChange={setIsEnabled} />
        </SectionCard>
        <SectionCard title="Custom ETA">
          <TextField label="ETA override" suffix="min" keyboardType="number-pad" placeholder="e.g. 30" hint="Leave empty to use the delivery tier or zone ETA" value={eta} onChangeText={setEta} />
        </SectionCard>
        <SectionCard title="Operating hours">
          <TimeSelect optional label="Start time" hint="Leave empty for 24/7 availability" value={start} onChange={setStart} />
          <TimeSelect optional label="End time" hint="Express is unavailable outside this window" value={end} onChange={setEnd} />
        </SectionCard>
      </LoadGate>
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 }, loading: { marginTop: 40 } });
