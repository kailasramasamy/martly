import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../../../constants/theme";
import { Button } from "../ui/Button";
import { manage } from "../ui/tokens";

interface NotInCatalogProps {
  onSnap?: () => void;
  onManual?: () => void;
}

/** Below catalog search results: create the product instead, carrying the search text over as its name */
export function NotInCatalog({ onSnap, onManual }: NotInCatalogProps) {
  if (!onSnap && !onManual) return null;
  return (
    <View style={styles.root}>
      <View style={styles.divider}>
        <View style={styles.rule} />
        <Text style={styles.title}>Can't find it? Create it</Text>
        <View style={styles.rule} />
      </View>
      {onSnap && <Button label="Easy add with AI" icon="sparkles" onPress={onSnap} />}
      {onManual && <Button label="Create manually" icon="create-outline" variant="secondary" onPress={onManual} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10, marginTop: 6 },
  divider: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 2 },
  rule: { flex: 1, height: 1, backgroundColor: manage.line },
  title: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary },
});
