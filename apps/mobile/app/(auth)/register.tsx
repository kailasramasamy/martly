import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { colors, spacing, fontSize } from "../../constants/theme";

export default function RegisterScreen() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  async function handleRegister() {
    try {
      setError("");
      if (!name.trim()) { setError("Name is required"); return; }
      if (!email.trim()) { setError("Email is required"); return; }
      if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
      if (password !== confirmPassword) { setError("Passwords do not match"); return; }
      await register({ name, email, password, phone: phone || undefined });
      router.replace("/(tabs)");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      // API Zod errors come as JSON strings — show a friendly message instead
      if (msg.startsWith("[") || msg.startsWith("{")) {
        setError("Please check your input and try again");
      } else {
        setError(msg);
      }
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Join Martly today</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextInput
        style={styles.input}
        placeholder="Full Name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />
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
      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />
      <TextInput
        style={styles.input}
        placeholder="Phone (optional)"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />
      <Pressable style={styles.button} onPress={handleRegister}>
        <Text style={styles.buttonText}>Sign Up</Text>
      </Pressable>

      <Pressable onPress={() => router.back()} style={styles.linkContainer}>
        <Text style={styles.linkText}>Already have an account? <Text style={styles.link}>Sign In</Text></Text>
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
  linkContainer: { marginTop: spacing.lg, alignItems: "center" },
  linkText: { fontSize: fontSize.md, color: colors.textSecondary },
  link: { color: colors.primary, fontWeight: "600" },
});
