import { View, Text, StyleSheet } from "react-native";
import { fonts } from "../../../constants/theme";
import { Button } from "../ui/Button";
import { manage } from "../ui/tokens";

interface SelectionBarProps {
  count: number;
  onClear: () => void;
  onAssign: () => void;
}

/** Shown while orders are selected on the delivery board; rendered inside a TabBottomDock above the tab bar */
export function SelectionBar({ count, onClear, onAssign }: SelectionBarProps) {
  return (
    <View style={styles.bar}>
      <Text style={styles.count}>{count} selected</Text>
      <Button label="Clear" variant="ghost" onPress={onClear} />
      <Button label="Assign rider" icon="bicycle-outline" onPress={onAssign} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", gap: 10, padding: 12, backgroundColor: manage.card, borderTopWidth: 1, borderTopColor: manage.line },
  count: { flex: 1, alignSelf: "center", fontFamily: fonts.bold, fontSize: 15 },
});
