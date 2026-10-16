import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../constants/theme";
import { manage } from "../ui/tokens";
import type { LocationAccess } from "./use-share-location";

/** Shown while location is off: ETAs start from the store and customers can't follow the rider */
export function LocationBanner({ access, onRetry }: { access: LocationAccess; onRetry: () => void }) {
  return (
    <View style={styles.banner}>
      <Ionicons name="location-outline" size={20} color={manage.attentionText} />
      <Text style={styles.text}>Location is off — ETAs start from the store and customers can't track you.</Text>
      <TouchableOpacity style={styles.button} onPress={onRetry} accessibilityRole="button">
        <Text style={styles.buttonText}>{access === "blocked" ? "Settings" : "Turn on"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, backgroundColor: manage.attentionBg },
  text: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: manage.attentionText },
  button: { minHeight: 44, minWidth: 64, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.accent },
  buttonText: { fontFamily: fonts.extrabold, fontSize: 13, color: colors.accentText },
});
