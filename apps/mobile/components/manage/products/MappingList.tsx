import { useState } from "react";
import { View, Text, Switch, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../constants/theme";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { SectionCard } from "../ui/SectionCard";
import { EmptyState } from "../ui/EmptyState";
import { formatINR, manage, tabular } from "../ui/tokens";
import type { StoreMapping } from "./types";

interface MappingListProps {
  mappings: StoreMapping[];
  canUnmap: boolean;
  busy: boolean;
  onToggle: (mapping: StoreMapping, field: "isActive" | "isFeatured", value: boolean) => void;
  onUnmap: (mapping: StoreMapping) => Promise<void>;
}

function ToggleCell({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: manage.line }} accessibilityLabel={label} />
    </View>
  );
}

function MappingRow({ mapping, canUnmap, onToggle, onAskUnmap }: Pick<MappingListProps, "onToggle" | "canUnmap"> & { mapping: StoreMapping; onAskUnmap: () => void }) {
  const available = mapping.stock - mapping.reservedStock;
  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <View style={styles.rowText}>
          <Text style={styles.store} numberOfLines={1}>{mapping.store.name}</Text>
          <Text style={[styles.meta, tabular]} numberOfLines={1}>
            {mapping.variant.name} · {formatINR(Number(mapping.price), { decimals: true })} · {available} in stock
          </Text>
        </View>
        {canUnmap && (
          <TouchableOpacity style={styles.unmap} onPress={onAskUnmap} accessibilityLabel={`Remove from ${mapping.store.name}`}>
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.toggles}>
        <ToggleCell label="Listed" value={mapping.isActive} onChange={(v) => onToggle(mapping, "isActive", v)} />
        <ToggleCell label="Featured" value={mapping.isFeatured} onChange={(v) => onToggle(mapping, "isFeatured", v)} />
      </View>
    </View>
  );
}

export function MappingList({ mappings, canUnmap, busy, onToggle, onUnmap }: MappingListProps) {
  const [pending, setPending] = useState<StoreMapping | null>(null);
  return (
    <SectionCard title={`Store listings (${mappings.length})`}>
      {mappings.length === 0 ? <EmptyState icon="storefront-outline" title="Not listed anywhere yet" /> : mappings.map((m) => (
        <MappingRow key={m.id} mapping={m} canUnmap={canUnmap} onToggle={onToggle} onAskUnmap={() => setPending(m)} />
      ))}
      <ConfirmDialog
        visible={!!pending}
        title="Remove from store?"
        message={pending ? `${pending.variant.name} will no longer be sold at ${pending.store.name}.${pending.reservedStock > 0 ? ` ${pending.reservedStock} unit(s) are reserved in active orders.` : ""}` : ""}
        confirmLabel="Remove"
        running={busy}
        onConfirm={async () => {
          if (pending) await onUnmap(pending);
          setPending(null);
        }}
        onClose={() => setPending(null)}
      />
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: manage.hairline },
  rowHead: { flexDirection: "row", alignItems: "center" },
  rowText: { flex: 1 },
  store: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  meta: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  unmap: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  toggles: { flexDirection: "row", gap: 24, marginTop: 6 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 8 },
  toggleLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
});
