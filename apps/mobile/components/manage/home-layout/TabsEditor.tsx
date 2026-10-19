import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "../../../constants/theme";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";
import { manage } from "../ui/tokens";
import { CollectionField } from "./CollectionField";
import { MAX_TABS, MIN_TABS, newKey, type TabDraft } from "./form";

interface TabsEditorProps {
  tabs: TabDraft[];
  onChange: (tabs: TabDraft[]) => void;
}

interface TabCardProps {
  tab: TabDraft;
  index: number;
  count: number;
  onPatch: (patch: Partial<TabDraft>) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}

function Step({ icon, label, disabled, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.step, disabled && styles.off]} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={20} color={colors.text} />
    </TouchableOpacity>
  );
}

function TabCard({ tab, index, count, onPatch, onMove, onRemove }: TabCardProps) {
  return (
    <View style={styles.card}>
      <TextField label={`Tab ${index + 1} label`} value={tab.label} onChangeText={(label) => onPatch({ label })} maxLength={40} />
      <CollectionField label="Collection" required value={tab.collectionId} onChange={(collectionId) => onPatch({ collectionId })} />
      <View style={styles.actions}>
        <Step icon="arrow-up" label="Move tab up" disabled={index === 0} onPress={() => onMove(index - 1)} />
        <Step icon="arrow-down" label="Move tab down" disabled={index === count - 1} onPress={() => onMove(index + 1)} />
        <View style={styles.spacer} />
        <Step icon="trash-outline" label="Remove tab" disabled={count <= MIN_TABS} onPress={onRemove} />
      </View>
    </View>
  );
}

/** One tab per collection; order here is the order on Home */
export function TabsEditor({ tabs, onChange }: TabsEditorProps) {
  const patch = (key: string, next: Partial<TabDraft>) => onChange(tabs.map((t) => (t.key === key ? { ...t, ...next } : t)));
  const move = (from: number, to: number) => {
    const next = [...tabs];
    next.splice(to, 0, ...next.splice(from, 1));
    onChange(next);
  };
  return (
    <View style={styles.list}>
      {tabs.map((t, i) => (
        <TabCard
          key={t.key}
          tab={t}
          index={i}
          count={tabs.length}
          onPatch={(next) => patch(t.key, next)}
          onMove={(to) => move(i, to)}
          onRemove={() => onChange(tabs.filter((x) => x.key !== t.key))}
        />
      ))}
      <Button label="Add tab" icon="add" variant="secondary" disabled={tabs.length >= MAX_TABS} onPress={() => onChange([...tabs, { key: newKey(), label: "", collectionId: null, imageUrl: null }])} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  card: { borderRadius: radius.lg, borderWidth: 1, borderColor: manage.line, backgroundColor: manage.canvas, paddingHorizontal: 12, paddingTop: 12 },
  actions: { flexDirection: "row", alignItems: "center", marginTop: -4 },
  step: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  off: { opacity: 0.3 },
  spacer: { flex: 1 },
});
