import { useState } from "react";
import { View, FlatList, StyleSheet } from "react-native";
import { BottomSheet } from "../../search/BottomSheet";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { SearchField } from "../ui/SearchField";
import { ListRow } from "../ui/ListRow";
import { EmptyState } from "../ui/EmptyState";
import { StatusPill } from "../ui/StatusPill";
import { ROLE_PILL } from "./constants";
import type { UserRow } from "./types";

interface UserPickerSheetProps {
  visible: boolean;
  excludeIds: string[];
  onClose: () => void;
  onPick: (user: UserRow) => void;
}

/** Searchable list of staff users (ORG_ADMIN and SUPER_ADMIN only, via GET /users) */
export function UserPickerSheet({ visible, excludeIds, onClose, onPick }: UserPickerSheetProps) {
  const [q, setQ] = useState("");
  const list = usePagedList<UserRow>("/api/v1/users", { q }, { pageSize: 30, enabled: visible });
  const users = list.items.filter((u) => !excludeIds.includes(u.id) && u.role !== "SUPER_ADMIN" && u.role !== "CUSTOMER");
  return (
    <BottomSheet flush visible={visible} title="Assign a user" onClose={onClose}>
      <View style={styles.search}><SearchField value={q} onChange={setQ} placeholder="Search by name or email" /></View>
      <FlatList
        keyboardDismissMode="on-drag"
        data={users}
        keyExtractor={(u) => u.id}
        keyboardShouldPersistTaps="handled"
        onEndReached={list.loadMore}
        ListEmptyComponent={<EmptyState icon="people-outline" title={list.loading ? "Searching" : "No users found"} message={list.error ?? "Create the user first from Team & users."} />}
        renderItem={({ item }) => (
          <ListRow title={item.name} subtitle={item.email} trailing={<StatusPill {...ROLE_PILL[item.role]} />} onPress={() => onPick(item)} />
        )}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({ search: { paddingHorizontal: 16, paddingBottom: 8 } });
