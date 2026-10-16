import { useEffect, useState } from "react";
import { FlatList, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../search/BottomSheet";
import { FieldFrame, type FieldFrameProps } from "../ui/FieldFrame";
import { fieldStyles as fs } from "../ui/fieldStyles";
import { SearchField } from "../ui/SearchField";
import { EmptyState } from "../ui/EmptyState";
import { manage } from "../ui/tokens";
import { colors, fonts } from "../../../constants/theme";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { api } from "../../../lib/api";

interface Named {
  id: string;
  name?: string;
  title?: string;
}

interface RemotePickerProps extends FieldFrameProps {
  /** List endpoint supporting `?q=`, e.g. /api/v1/products */
  path: string;
  value: string | null;
  onChange: (id: string) => void;
  placeholder?: string;
}

const labelOf = (item: Named) => item.name ?? item.title ?? item.id;

/** Select field backed by a searchable server list; resolves the selected id to its name for display */
export function RemotePicker({ path, value, onChange, placeholder = "Select", ...frame }: RemotePickerProps) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!value) return setLabel(null);
    let cancelled = false;
    api.get<Named>(`${path}/${value}`).then((res) => !cancelled && setLabel(labelOf(res.data))).catch(() => !cancelled && setLabel(null));
    return () => { cancelled = true; };
  }, [path, value]);

  return (
    <FieldFrame {...frame}>
      <TouchableOpacity style={[fs.box, !!frame.error && fs.boxError]} onPress={() => setOpen(true)} activeOpacity={0.7} accessibilityRole="button">
        <Text style={[fs.text, !value && fs.placeholder]} numberOfLines={1}>{value ? label ?? "Selected" : placeholder}</Text>
        <Ionicons name="chevron-down" size={18} color={manage.muted} />
      </TouchableOpacity>
      {open && <PickerSheet path={path} title={frame.label ?? "Select"} onClose={() => setOpen(false)} onPick={(item) => { setLabel(labelOf(item)); onChange(item.id); setOpen(false); }} />}
    </FieldFrame>
  );
}

interface SheetProps {
  path: string;
  title: string;
  onClose: () => void;
  onPick: (item: Named) => void;
}

function PickerSheet({ path, title, onClose, onPick }: SheetProps) {
  const [q, setQ] = useState("");
  const list = usePagedList<Named>(path, { q });
  return (
    <BottomSheet flush visible title={title} onClose={onClose}>
      <View style={styles.search}><SearchField value={q} onChange={setQ} /></View>
      <FlatList
        keyboardDismissMode="on-drag"
        data={list.items}
        keyExtractor={(i) => i.id}
        keyboardShouldPersistTaps="handled"
        onEndReached={list.loadMore}
        style={styles.list}
        ListEmptyComponent={list.loading ? null : <EmptyState icon="search-outline" title="No matches" />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.option} onPress={() => onPick(item)} activeOpacity={0.7}>
            <Text style={styles.optionLabel} numberOfLines={2}>{labelOf(item)}</Text>
          </TouchableOpacity>
        )}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  search: { paddingHorizontal: 16, paddingBottom: 8 },
  list: { maxHeight: 420, paddingHorizontal: 16 },
  option: { minHeight: 52, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: manage.hairline },
  optionLabel: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
});
