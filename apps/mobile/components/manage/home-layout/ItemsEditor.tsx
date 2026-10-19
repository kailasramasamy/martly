import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius } from "../../../constants/theme";
import { Button } from "../ui/Button";
import { SwitchRow } from "../ui/SwitchRow";
import { TextField } from "../ui/TextField";
import { manage } from "../ui/tokens";
import { CollectionField } from "./CollectionField";
import { newKey, type ItemDraft, type ItemLimits } from "./form";

interface ItemsEditorProps extends ItemLimits {
  items: ItemDraft[];
  onChange: (items: ItemDraft[]) => void;
  /** Grid tiles can span the full row */
  wideLabel?: string;
}

interface ItemCardProps {
  item: ItemDraft;
  noun: string;
  min: number;
  wideLabel?: string;
  index: number;
  count: number;
  onPatch: (patch: Partial<ItemDraft>) => void;
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

function ItemCard({ item, noun, min, wideLabel, index, count, onPatch, onMove, onRemove }: ItemCardProps) {
  return (
    <View style={styles.card}>
      <TextField label={`${noun} ${index + 1} label`} value={item.label} onChangeText={(label) => onPatch({ label })} maxLength={40} />
      <CollectionField label="Collection" required value={item.collectionId} onChange={(collectionId) => onPatch({ collectionId })} />
      {wideLabel ? <SwitchRow label={wideLabel} value={item.wide} onValueChange={(wide) => onPatch({ wide })} /> : null}
      <View style={styles.actions}>
        <Step icon="arrow-up" label={`Move ${noun} up`} disabled={index === 0} onPress={() => onMove(index - 1)} />
        <Step icon="arrow-down" label={`Move ${noun} down`} disabled={index === count - 1} onPress={() => onMove(index + 1)} />
        <View style={styles.spacer} />
        <Step icon="trash-outline" label={`Remove ${noun}`} disabled={count <= min} onPress={onRemove} />
      </View>
    </View>
  );
}

/** One tab or tile per collection; order here is the order on Home */
export function ItemsEditor({ items, onChange, min, max, noun, wideLabel }: ItemsEditorProps) {
  const patch = (key: string, next: Partial<ItemDraft>) => onChange(items.map((t) => (t.key === key ? { ...t, ...next } : t)));
  const move = (from: number, to: number) => {
    const next = [...items];
    next.splice(to, 0, ...next.splice(from, 1));
    onChange(next);
  };
  const blank: ItemDraft = { key: "", label: "", collectionId: null, imageUrl: null, subcategoryIds: [], wide: false };
  return (
    <View style={styles.list}>
      {items.map((t, i) => (
        <ItemCard
          key={t.key}
          item={t}
          noun={noun[0].toUpperCase() + noun.slice(1)}
          min={min}
          wideLabel={wideLabel}
          index={i}
          count={items.length}
          onPatch={(next) => patch(t.key, next)}
          onMove={(to) => move(i, to)}
          onRemove={() => onChange(items.filter((x) => x.key !== t.key))}
        />
      ))}
      <Button label={`Add ${noun}`} icon="add" variant="secondary" disabled={items.length >= max} onPress={() => onChange([...items, { ...blank, key: newKey() }])} />
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
