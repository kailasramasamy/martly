import { useState } from "react";
import { View, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { Loader } from "../../Loader";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius } from "../../../constants/theme";
import { manage } from "../ui/tokens";

interface ComposerProps {
  sending: boolean;
  onSend: (text: string) => Promise<boolean>;
}

export function Composer({ sending, onSend }: ComposerProps) {
  const [text, setText] = useState("");
  const ready = text.trim().length > 0 && !sending;

  const send = async () => {
    if (await onSend(text.trim())) setText("");
  };

  return (
    <View style={styles.row}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Reply to the customer"
        placeholderTextColor={manage.muted}
        multiline
        maxLength={2000}
        accessibilityLabel="Reply"
      />
      <TouchableOpacity style={[styles.send, !ready && styles.sendOff]} onPress={send} disabled={!ready} accessibilityLabel="Send reply">
        {sending ? <Loader color="#fff" size="small" /> : <Ionicons name="send" size={18} color="#fff" />}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: "row", alignItems: "flex-end", gap: 10 },
  input: {
    flex: 1, minHeight: 44, maxHeight: 120, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: radius.lg, borderWidth: 1, borderColor: manage.line, backgroundColor: manage.canvas,
    fontFamily: fonts.medium, fontSize: 15, color: colors.text,
  },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  sendOff: { opacity: 0.4 },
});
