import { View, StyleSheet } from "react-native";
import { radius } from "../../../constants/theme";
import { SkeletonBox } from "../../SkeletonLoader";
import { manage } from "./tokens";

interface GridSkeletonProps {
  columns: number;
  /** Tile width, as the real grid computes it */
  width: number;
  gap: number;
  /** Side padding of the real grid, so placeholders sit where the tiles will */
  padding: number;
  rows?: number;
}

/** Placeholder PhotoTiles: square photo, dots row, two-line name and a meta line */
export function GridSkeleton({ columns, width, gap, padding, rows = 3 }: GridSkeletonProps) {
  return (
    <View style={[styles.root, { gap, paddingHorizontal: padding }]}>
      {Array.from({ length: rows }, (_, r) => (
        <View key={r} style={[styles.row, { gap }]}>
          {Array.from({ length: columns }, (_, c) => (
            <View key={c} style={[styles.card, { width }]}>
              <SkeletonBox width={width} height={width} borderRadius={0} />
              <View style={styles.text}>
                <SkeletonBox width="90%" height={11} />
                <SkeletonBox width="60%" height={11} />
                <SkeletonBox width="50%" height={9} />
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingVertical: 12 },
  row: { flexDirection: "row" },
  card: { backgroundColor: manage.card, borderRadius: radius.lg, borderWidth: 1, borderColor: manage.line, overflow: "hidden" },
  // Matches PhotoTile: dots strip (11) + text padding, so the tile height lines up with the real one
  text: { paddingHorizontal: 8, paddingTop: 17, paddingBottom: 8, gap: 6 },
});
