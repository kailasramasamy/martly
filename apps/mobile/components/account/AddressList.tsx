import { Fragment } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { ADDRESS_ICONS } from "./AddressSheet";
import type { UserAddress } from "../../lib/types";

interface Props {
  addresses: UserAddress[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (address: UserAddress) => void;
  onDelete: (address: UserAddress) => void;
}

function AddressRow({ address, onEdit, onDelete }: { address: UserAddress; onEdit: () => void; onDelete: () => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.icon}>
        <Ionicons name={ADDRESS_ICONS[address.label] ?? "location-outline"} size={18} color={colors.primary} />
      </View>
      <View style={styles.info}>
        <View style={styles.labelRow}>
          <Text style={styles.label} numberOfLines={1}>{address.placeName || address.label}</Text>
          {address.isDefault && <Text style={styles.defaultBadge}>DEFAULT</Text>}
        </View>
        <Text style={styles.address} numberOfLines={2}>{address.address}</Text>
      </View>
      <TouchableOpacity style={styles.action} onPress={onEdit} accessibilityLabel="Edit address">
        <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.action} onPress={onDelete} accessibilityLabel="Delete address">
        <Ionicons name="trash-outline" size={18} color={colors.error} />
      </TouchableOpacity>
    </View>
  );
}

export function AddressList({ addresses, loading, onAdd, onEdit, onDelete }: Props) {
  return (
    <View style={styles.group}>
      <View style={styles.header}>
        <Text style={styles.title}>Saved addresses</Text>
        <TouchableOpacity style={styles.add} onPress={onAdd} hitSlop={6}>
          <Ionicons name="add" size={16} color={colors.primary} />
          <Text style={styles.addText}>Add new</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.card}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : addresses.length === 0 ? (
          <TouchableOpacity style={styles.empty} onPress={onAdd}>
            <Ionicons name="map-outline" size={22} color={colors.primary} />
            <Text style={styles.emptyText}>Add an address for faster checkout</Text>
          </TouchableOpacity>
        ) : (
          addresses.map((a, i) => (
            <Fragment key={a.id}>
              {i > 0 && <View style={styles.divider} />}
              <AddressRow address={a} onEdit={() => onEdit(a)} onDelete={() => onDelete(a)} />
            </Fragment>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginTop: 22 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8, marginHorizontal: 4 },
  title: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.textSecondary, letterSpacing: 0.6, textTransform: "uppercase" },
  add: { flexDirection: "row", alignItems: "center", gap: 2 },
  addText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.primary },
  card: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  icon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#f0fdfa", alignItems: "center", justifyContent: "center" },
  info: { flex: 1 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, flexShrink: 1 },
  defaultBadge: {
    fontFamily: fonts.extrabold, fontSize: 9.5, color: colors.primary, backgroundColor: "#ccfbf1",
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: "hidden", letterSpacing: 0.5,
  },
  address: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textSecondary, marginTop: 2 },
  action: { width: 36, height: 44, alignItems: "center", justifyContent: "center" },
  divider: { height: 1, backgroundColor: "#f1f5f9", marginLeft: 60 },
  loading: { marginVertical: 22 },
  empty: { flexDirection: "row", alignItems: "center", gap: 10, padding: 18 },
  emptyText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
});
