import { Text, StyleSheet } from "react-native";
import { fonts } from "../../../constants/theme";
import { Button } from "../ui/Button";
import { StickyActionBar } from "../ui/StickyActionBar";

interface SelectionBarProps {
  count: number;
  onClear: () => void;
  onAssign: () => void;
}

export function SelectionBar({ count, onClear, onAssign }: SelectionBarProps) {
  return (
    <StickyActionBar>
      <Text style={styles.count}>{count} selected</Text>
      <Button label="Clear" variant="ghost" onPress={onClear} />
      <Button label="Assign rider" icon="bicycle-outline" onPress={onAssign} />
    </StickyActionBar>
  );
}

const styles = StyleSheet.create({
  count: { flex: 1, alignSelf: "center", fontFamily: fonts.bold, fontSize: 15 },
});
