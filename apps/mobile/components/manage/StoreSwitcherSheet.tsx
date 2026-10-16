import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { BottomSheet } from "../search/BottomSheet";
import { useManageScope, type ManagedStore } from "../../lib/manage-scope-context";
import { manage } from "./ui/tokens";

function groupByOrg(stores: ManagedStore[]): [string, ManagedStore[]][] {
  const groups = new Map<string, ManagedStore[]>();
  for (const s of stores) groups.set(s.organizationName, [...(groups.get(s.organizationName) ?? []), s]);
  return [...groups.entries()];
}

function Option({ label, sub, selected, onPress }: { label: string; sub?: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.option} onPress={onPress} activeOpacity={0.7} accessibilityState={{ selected }}>
      <View style={styles.optionText}>
        <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>{label}</Text>
        {sub ? <Text style={styles.sub} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {selected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
    </TouchableOpacity>
  );
}

export function StoreSwitcherSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { stores, storeId, setStoreId, allowAllStores } = useManageScope();
  const groups = groupByOrg(stores);
  const pick = (id: string | null) => {
    setStoreId(id);
    onClose();
  };

  return (
    <BottomSheet flush visible={visible} title="Switch store" onClose={onClose}>
      <ScrollView
        keyboardDismissMode="on-drag" contentContainerStyle={styles.list}>
        {allowAllStores && (
          <Option label="All stores" sub={`${stores.length} stores`} selected={storeId === null} onPress={() => pick(null)} />
        )}
        {groups.map(([org, orgStores]) => (
          <View key={org}>
            {groups.length > 1 && <Text style={styles.group}>{org}</Text>}
            {orgStores.map((s) => (
              <Option key={s.id} label={s.name} sub={s.address} selected={storeId === s.id} onPress={() => pick(s.id)} />
            ))}
          </View>
        ))}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingBottom: 8 },
  group: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.9, textTransform: "uppercase", color: colors.textSecondary, marginTop: 14, marginBottom: 2 },
  option: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, borderBottomWidth: 1, borderBottomColor: manage.hairline },
  optionText: { flex: 1 },
  label: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  labelSelected: { fontFamily: fonts.bold, color: colors.primary },
  sub: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
});
