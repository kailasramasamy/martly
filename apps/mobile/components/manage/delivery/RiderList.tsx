import { Text, ScrollView, StyleSheet } from "react-native";
import { colors, fonts } from "../../../constants/theme";
import { useResource } from "../../../lib/manage/use-resource";
import { EmptyState } from "../ui/EmptyState";
import { ListRow } from "../ui/ListRow";
import type { RiderOption } from "./types";

interface RiderListProps {
  storeId: string;
  value: string | null;
  onChange: (riderId: string) => void;
  onManageRiders: () => void;
}

/** The store's riders to pick one from, with loading, error and no-riders states */
export function RiderList({ storeId, value, onChange, onManageRiders }: RiderListProps) {
  const riders = useResource<RiderOption[]>(`/api/v1/delivery-trips/riders?storeId=${storeId}`);
  return (
    <>
      {riders.loading ? <Text style={styles.note}>Loading riders…</Text> : null}
      {riders.error ? <EmptyState icon="cloud-offline-outline" title="Couldn't load riders" message={riders.error} action={{ label: "Try again", onPress: riders.reload }} /> : null}
      {riders.data && riders.data.length === 0 ? (
        <EmptyState icon="bicycle-outline" title="No riders at this store" action={{ label: "Add a rider", onPress: onManageRiders }} />
      ) : null}
      <ScrollView keyboardDismissMode="on-drag">
        {riders.data?.map((r) => (
          <ListRow key={r.id} icon="bicycle-outline" title={r.name} subtitle={r.phone ?? r.email} selected={r.id === value} onPress={() => onChange(r.id)} />
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, padding: 16 },
});
