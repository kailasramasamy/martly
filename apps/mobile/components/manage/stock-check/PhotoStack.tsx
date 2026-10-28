import { View, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius } from "../../../constants/theme";
import { manage } from "../ui/tokens";

/** A few product photos side by side, so a department or brand is recognised before its name is read */
export function PhotoStack({ urls, size = 44 }: { urls: string[]; size?: number }) {
  const box = { width: size, height: size };
  if (urls.length === 0) {
    return <View style={[styles.photo, styles.empty, box]}><Ionicons name="image-outline" size={18} color={manage.muted} /></View>;
  }
  return (
    <View style={styles.row}>
      {urls.map((uri, i) => (
        <Image key={uri} source={{ uri }} style={[styles.photo, box, i > 0 && { marginLeft: -size / 4 }]} resizeMode="contain" />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  photo: { borderRadius: radius.md, backgroundColor: manage.card, borderWidth: 1.5, borderColor: manage.card },
  empty: { alignItems: "center", justifyContent: "center", backgroundColor: manage.hairline },
});
