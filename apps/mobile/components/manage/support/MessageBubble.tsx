import { View, Text, StyleSheet } from "react-native";
import { colors, fonts, radius } from "../../../constants/theme";
import { manage } from "../ui/tokens";
import type { TicketMessage } from "./types";

const ROLE = {
  user: { label: "Customer", bg: "#eff6ff", fg: "#1d4ed8", align: "flex-start" as const },
  assistant: { label: "Martly support", bg: "#f0fdfa", fg: "#0f766e", align: "flex-start" as const },
  admin: { label: "Team", bg: "#fef3c7", fg: "#92400e", align: "flex-end" as const },
};

export function MessageBubble({ message }: { message: TicketMessage }) {
  const role = ROLE[message.role] ?? ROLE.user;
  const time = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : "";
  return (
    <View style={[styles.wrap, { alignItems: role.align }]}>
      <View style={[styles.bubble, { backgroundColor: role.bg }]}>
        <Text style={[styles.who, { color: role.fg }]}>{role.label}{time ? ` · ${time}` : ""}</Text>
        <Text style={styles.text} selectable>{message.content}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%" },
  bubble: { maxWidth: "88%", borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: manage.line },
  who: { fontFamily: fonts.bold, fontSize: 11, marginBottom: 2 },
  text: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.text },
});
