import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { api } from "../../lib/api";
import { colors, spacing, fontSize } from "../../constants/theme";
import type { AuthTokens } from "@martly/shared/types";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleLogin() {
    try {
      setError("");
      const result = await api.post<AuthTokens>("/api/v1/auth/login", { email, password });
      await login(result.data);
      router.replace("/(tabs)");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Martly</Text>
      <Text style={styles.subtitle}>Fresh groceries, delivered</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Pressable style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Sign In</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: spacing.lg, backgroundColor: colors.background },
  title: { fontSize: fontSize.xxl, fontWeight: "bold", textAlign: "center", color: colors.primary },
  subtitle: { fontSize: fontSize.lg, textAlign: "center", color: colors.textSecondary, marginBottom: spacing.xl },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    padding: spacing.md, marginBottom: spacing.md, fontSize: fontSize.md,
  },
  button: {
    backgroundColor: colors.primary, padding: spacing.md,
    borderRadius: 8, alignItems: "center", marginTop: spacing.sm,
  },
  buttonText: { color: "#fff", fontSize: fontSize.lg, fontWeight: "600" },
  error: { color: colors.error, textAlign: "center", marginBottom: spacing.md },
});
