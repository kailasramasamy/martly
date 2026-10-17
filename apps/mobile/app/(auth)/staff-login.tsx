import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, ScrollView, Platform, Image } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { LoginResponse } from "@martly/shared/types";
import { useAuth } from "../../lib/auth-context";
import { api } from "../../lib/api";
import { completeLogin } from "../../lib/org-selection";
import { useKeyboardReveal } from "../../lib/use-keyboard-reveal";
import { colors, spacing, fontSize, fonts } from "../../constants/theme";

const wordmark = require("../../assets/branding/martly-wordmark-light.png");

export default function StaffLoginScreen() {
  const { login } = useAuth();
  const keyboard = useKeyboardReveal();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    if (!email.trim() || !password) {
      setError("Enter your work email and password");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await api.post<LoginResponse>("/api/v1/auth/login", { email: email.trim().toLowerCase(), password });
      await completeLogin(res.data, login);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View ref={keyboard.rootRef} onLayout={keyboard.onRootLayout} style={{ flex: 1 }}>
      <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={keyboard.topOffset}
    >
      <ScrollView keyboardDismissMode="on-drag" ref={keyboard.scrollRef} onScroll={keyboard.onScroll} scrollEventThrottle={16} contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled" bounces={false}>
        <View style={styles.logoSection}>
          <Image source={wordmark} style={styles.wordmark} resizeMode="contain" accessibilityLabel="Martly" />
          <View style={styles.badge}>
            <Ionicons name="storefront-outline" size={13} color={colors.primary} />
            <Text style={styles.badgeText}>Martly for Business</Text>
          </View>
        </View>

        <Text style={styles.title}>Staff sign in</Text>
        <Text style={styles.subtitle}>Manage orders, inventory and deliveries for your stores</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>Work email</Text>
        <TextInput
          style={styles.input}
          placeholder="you@store.com"
          placeholderTextColor="#94a3b8"
          value={email}
          onChangeText={(t) => { setEmail(t); setError(""); }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="username"
          autoFocus
        />

        <Text style={styles.label}>Password</Text>
        <View style={styles.passwordRow}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Password"
            placeholderTextColor="#94a3b8"
            value={password}
            onChangeText={(t) => { setPassword(t); setError(""); }}
            secureTextEntry={!showPassword}
            autoComplete="password"
            textContentType="password"
            onSubmitEditing={handleSignIn}
            returnKeyType="go"
          />
          <Pressable
            onPress={() => setShowPassword((v) => !v)}
            style={styles.eye}
            accessibilityLabel={showPassword ? "Hide password" : "Show password"}
          >
            <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textSecondary} />
          </Pressable>
        </View>

        <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSignIn} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.buttonText}>Sign in</Text>}
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.linkContainer} accessibilityRole="link">
          <Text style={styles.linkText}>
            <Ionicons name="arrow-back" size={13} color={colors.textSecondary} /> Shopping? Sign in with your phone
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  inner: { flexGrow: 1, justifyContent: "center", padding: spacing.lg },
  logoSection: { alignItems: "center", marginBottom: 32 },
  wordmark: { width: 160, height: 65 },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6,
    paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: "#f0fdfa",
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 12, color: colors.primary, letterSpacing: 0.3 },
  title: { fontSize: 22, fontWeight: "700", color: colors.text, textAlign: "center", marginBottom: 6 },
  subtitle: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: "center", lineHeight: 20, marginBottom: spacing.lg },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    padding: 16, fontSize: fontSize.lg, color: colors.text, marginBottom: spacing.md,
  },
  passwordRow: {
    flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, marginBottom: spacing.lg,
  },
  passwordInput: { flex: 1, padding: 16, fontSize: fontSize.lg, color: colors.text },
  eye: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  button: { backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: "center" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: fontSize.lg, fontWeight: "700" },
  error: { color: colors.error, textAlign: "center", marginBottom: spacing.md, fontSize: fontSize.md },
  linkContainer: { marginTop: spacing.lg, alignItems: "center", minHeight: 44, justifyContent: "center" },
  linkText: { fontSize: fontSize.md, color: colors.textSecondary },
});
