import { View, StyleSheet } from "react-native";
import { SkeletonBox } from "../../SkeletonLoader";
import { manage } from "./tokens";

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <View>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.row}>
          <SkeletonBox width={40} height={40} borderRadius={10} />
          <View style={styles.lines}>
            <SkeletonBox width="60%" height={13} />
            <SkeletonBox width="40%" height={11} />
          </View>
          <SkeletonBox width={56} height={14} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, height: 64, paddingHorizontal: 14, backgroundColor: manage.card, borderBottomWidth: 1, borderBottomColor: manage.hairline },
  lines: { flex: 1, gap: 7 },
});
