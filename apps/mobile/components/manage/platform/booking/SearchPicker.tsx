import { useEffect, useState } from "react";
import { FlatList, Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../../search/BottomSheet";
import { FieldFrame, type FieldFrameProps } from "../../ui/FieldFrame";
import { fieldStyles as fs } from "../../ui/fieldStyles";
import { SearchField } from "../../ui/SearchField";
import { EmptyState } from "../../ui/EmptyState";
import { manage } from "../../ui/tokens";
import { colors, fonts } from "../../../../constants/theme";
import { usePagedList } from "../../../../lib/manage/use-paged-list";
import type { QueryValue } from "../../../../lib/manage/query";

interface SearchPickerProps<T extends { id: string; name: string }> extends FieldFrameProps {
  /** List endpoint supporting `?q=` */
  path: string;
  params?: Record<string, QueryValue>;
  value: string | null;
  /** Name to show before anything is picked, e.g. when editing */
  initialLabel?: string;
  onPick: (item: T) => void;
  placeholder?: string;
  disabled?: boolean;
}

/** Select field backed by a searchable server list; keeps the picked item's name for display */
export function SearchPicker<T extends { id: string; name: string }>(props: SearchPickerProps<T>) {
  const { path, params, value, initialLabel, onPick, placeholder = "Select", disabled, ...frame } = props;
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(initialLabel ?? null);
  useEffect(() => { if (!value) setLabel(null); }, [value]);

  return (
    <FieldFrame {...frame}>
      <TouchableOpacity
        style={[fs.box, !!frame.error && fs.boxError, disabled && fs.boxDisabled]}
        onPress={() => setOpen(true)}
        disabled={disabled}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${frame.label ?? "Select"}: ${label ?? "none"}`}
      >
        <Text style={[fs.text, !value && fs.placeholder]} numberOfLines={1}>{value ? label ?? "Selected" : placeholder}</Text>
        <Ionicons name="chevron-down" size={18} color={manage.muted} />
      </TouchableOpacity>
      {open && (
        <PickerSheet<T>
          path={path}
          params={params}
          title={frame.label ?? "Select"}
          onClose={() => setOpen(false)}
          onPick={(item) => { setLabel(item.name); onPick(item); setOpen(false); }}
        />
      )}
    </FieldFrame>
  );
}

interface SheetProps<T> {
  path: string;
  params?: Record<string, QueryValue>;
  title: string;
  onClose: () => void;
  onPick: (item: T) => void;
}

function PickerSheet<T extends { id: string; name: string }>({ path, params, title, onClose, onPick }: SheetProps<T>) {
  const [q, setQ] = useState("");
  const list = usePagedList<T>(path, { ...params, q });
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
            <Text style={styles.optionLabel} numberOfLines={2}>{item.name}</Text>
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
