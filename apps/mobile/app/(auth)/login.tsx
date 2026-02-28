import { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, ScrollView, Platform } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth-context";
import { api, setAccessToken } from "../../lib/api";
import { colors, spacing, fontSize } from "../../constants/theme";
import type { AuthTokens } from "@martly/shared/types";

type Step = "phone" | "otp" | "name";

export default function LoginScreen() {
  const { login, refreshUser } = useAuth();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const otpRef = useRef<TextInput>(null);
  const pendingTokensRef = useRef<AuthTokens | null>(null);

  useEffect(() => {
    if (step === "otp") {
      setTimeout(() => otpRef.current?.focus(), 300);
    }
  }, [step]);

  async function handleSendOtp() {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 10) {
      setError("Please enter a valid 10-digit phone number");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await api.post("/api/v1/auth/send-otp", { phone: cleaned });
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (otp.length !== 6) {
      setError("Please enter the 6-digit OTP");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const cleaned = phone.replace(/\D/g, "");
      const result = await api.post<AuthTokens & { isNewUser: boolean }>("/api/v1/auth/verify-otp", {
        phone: cleaned,
        otp,
      });
      if (result.data.isNewUser) {
        // Set token for API calls (to save name) but don't trigger auth redirect yet
        setAccessToken(result.data.accessToken);
        pendingTokensRef.current = result.data;
        setStep("name");
      } else {
        await login(result.data);
        // Root layout auth redirect will navigate to /(tabs)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveName() {
    if (!name.trim()) {
      setError("Please enter your name");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await api.put("/api/v1/auth/profile", { name: name.trim() });
      // Now complete login — this triggers isAuthenticated = true
      // and root layout will redirect to /(tabs)
      if (pendingTokensRef.current) {
        await login(pendingTokensRef.current);
        pendingTokensRef.current = null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save name");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Logo */}
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <Ionicons name="leaf" size={36} color="#fff" />
          </View>
          <Text style={styles.title}>Martly</Text>
          <Text style={styles.subtitle}>Fresh groceries, delivered</Text>
        </View>

        {/* Phone Step */}
        {step === "phone" && (
          <View style={styles.formSection}>
            <Text style={styles.stepTitle}>Enter your phone number</Text>
            <Text style={styles.stepSubtitle}>We'll send you a verification code</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.phoneInputRow}>
              <View style={styles.countryCode}>
                <Text style={styles.countryCodeText}>+91</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                placeholder="Phone number"
                placeholderTextColor="#94a3b8"
                value={phone}
                onChangeText={(t) => { setPhone(t); setError(""); }}
                keyboardType="phone-pad"
                maxLength={10}
                autoFocus
              />
            </View>

            <Pressable
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSendOtp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.buttonText}>Continue</Text>
              )}
            </Pressable>
          </View>
        )}

        {/* OTP Step */}
        {step === "otp" && (
          <View style={styles.formSection}>
            <Text style={styles.stepTitle}>Verify your number</Text>
            <Text style={styles.stepSubtitle}>
              Enter the 6-digit code sent to{"\n"}
              <Text style={{ fontWeight: "700", color: colors.text }}>+91 {phone}</Text>
            </Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TextInput
              ref={otpRef}
              style={styles.otpInput}
              placeholder="000000"
              placeholderTextColor="#cbd5e1"
              value={otp}
              onChangeText={(t) => { setOtp(t.replace(/\D/g, "")); setError(""); }}
              keyboardType="number-pad"
              maxLength={6}
              textContentType="oneTimeCode"
            />

            <Pressable
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleVerifyOtp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.buttonText}>Verify</Text>
              )}
            </Pressable>

            <Pressable onPress={() => { setStep("phone"); setOtp(""); setError(""); }} style={styles.linkContainer}>
              <Text style={styles.linkText}>
                <Ionicons name="arrow-back" size={13} color={colors.textSecondary} /> Change number
              </Text>
            </Pressable>
          </View>
        )}

        {/* Name Step (new user) */}
        {step === "name" && (
          <View style={styles.formSection}>
            <Text style={styles.stepTitle}>What's your name?</Text>
            <Text style={styles.stepSubtitle}>Let us know what to call you</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TextInput
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor="#94a3b8"
              value={name}
              onChangeText={(t) => { setName(t); setError(""); }}
              autoCapitalize="words"
              autoFocus
            />

            <Pressable
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSaveName}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.buttonText}>Get Started</Text>
              )}
            </Pressable>
          </View>
        )}

        {/* Dev hint */}
        {step === "otp" && (
          <View style={styles.devHint}>
            <Ionicons name="information-circle-outline" size={14} color="#94a3b8" />
            <Text style={styles.devHintText}>Use OTP: 111111</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  inner: { flexGrow: 1, justifyContent: "center", padding: spacing.lg },

  // Logo
  logoSection: { alignItems: "center", marginBottom: 40 },
  logoCircle: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: "center", alignItems: "center",
    marginBottom: 16,
  },
  title: { fontSize: 32, fontWeight: "800", color: colors.primary },
  subtitle: { fontSize: fontSize.lg, color: colors.textSecondary, marginTop: 4 },

  // Steps
  formSection: { width: "100%" },
  stepTitle: { fontSize: 22, fontWeight: "700", color: colors.text, marginBottom: 6, textAlign: "center" },
  stepSubtitle: { fontSize: fontSize.md, color: colors.textSecondary, marginBottom: spacing.lg, lineHeight: 20, textAlign: "center" },

  // Phone input
  phoneInputRow: { flexDirection: "row", gap: 8, marginBottom: spacing.md },
  countryCode: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 16, justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
  countryCodeText: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text },
  phoneInput: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    padding: 16, fontSize: 18, fontWeight: "500", color: colors.text,
    letterSpacing: 1,
  },

  // OTP input
  otpInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    padding: 16, fontSize: 28, fontWeight: "700", color: colors.text,
    textAlign: "center", letterSpacing: 12,
    marginBottom: spacing.md,
  },

  // Generic input
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    padding: 16, fontSize: fontSize.lg, color: colors.text,
    marginBottom: spacing.md,
  },

  // Button
  button: {
    backgroundColor: colors.primary, padding: 16,
    borderRadius: 12, alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: fontSize.lg, fontWeight: "700" },

  error: { color: colors.error, textAlign: "center", marginBottom: spacing.md, fontSize: fontSize.md },

  linkContainer: { marginTop: spacing.lg, alignItems: "center" },
  linkText: { fontSize: fontSize.md, color: colors.textSecondary },

  devHint: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, marginTop: 24, opacity: 0.6,
  },
  devHintText: { fontSize: 12, color: "#94a3b8" },
});
