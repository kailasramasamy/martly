import type { ComponentType } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../constants/theme";
import { useAuth } from "../lib/auth-context";
import { useRequireSignIn } from "../lib/sign-in-context";

interface SignInPromptProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
}

/** Shown in place of an account-only screen for guests; signing in reveals the screen underneath */
export function SignInPrompt({ icon, title, message }: SignInPromptProps) {
  const requireSignIn = useRequireSignIn();
  return (
    <View style={styles.root}>
      <View style={styles.icon}><Ionicons name={icon} size={30} color={colors.primary} /></View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed]} onPress={() => requireSignIn(() => {}, { title, subtitle: "Enter your phone number to continue" })} accessibilityRole="button">
        <Text style={styles.buttonText}>Sign in with phone</Text>
      </Pressable>
    </View>
  );
}

/** An account-only screen: guests get a sign-in card, and the screen (with its data loading) mounts once they sign in */
export function withSignIn(Screen: ComponentType, prompt: SignInPromptProps) {
  return function SignedInOnly() {
    const { isAuthenticated, isLoading } = useAuth();
    if (isLoading) return null;
    return isAuthenticated ? <Screen /> : <SignInPrompt {...prompt} />;
  };
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },
  icon: { width: 72, height: 72, borderRadius: 24, backgroundColor: "#f0fdfa", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  title: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.text, textAlign: "center" },
  message: { fontFamily: fonts.medium, fontSize: 14.5, lineHeight: 21, color: colors.textSecondary, textAlign: "center", maxWidth: 300 },
  button: { marginTop: 10, backgroundColor: colors.primary, borderRadius: 14, height: 50, paddingHorizontal: 28, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.88 },
  buttonText: { fontFamily: fonts.bold, fontSize: 16, color: "#fff" },
});
