import { View, Text, Image, StyleSheet } from "react-native";
import { manage } from "../../ui/tokens";
import { colors, fonts, radius } from "../../../../constants/theme";

interface Props {
  title: string;
  body: string;
  imageUrl: string | null;
}

/** Approximation of how the push looks on a customer's lock screen */
export function NotificationPreview({ title, body, imageUrl }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.icon}><Text style={styles.iconText}>M</Text></View>
        <View style={styles.text}>
          <Text style={styles.app}>MARTLY</Text>
          <Text style={styles.title} numberOfLines={2}>{title || "Title"}</Text>
          <Text style={styles.body} numberOfLines={4}>{body || "Message"}</Text>
        </View>
      </View>
      {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: manage.canvas, borderRadius: radius.lg, padding: 12, borderWidth: 1, borderColor: manage.line },
  row: { flexDirection: "row", gap: 10 },
  icon: { width: 36, height: 36, borderRadius: 9, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  iconText: { fontFamily: fonts.extrabold, fontSize: 16, color: "#fff" },
  text: { flex: 1 },
  app: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.textSecondary, letterSpacing: 0.8 },
  title: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text, marginTop: 2 },
  body: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.text, marginTop: 2 },
  image: { width: "100%", aspectRatio: 2, borderRadius: radius.md, marginTop: 10 },
});
