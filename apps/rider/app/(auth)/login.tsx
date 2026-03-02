import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../lib/auth-context";
import { api, setAccessToken } from "../../lib/api";
import { colors, spacing, fontSize, borderRadius, fonts } from "../../constants/theme";
import type { AuthTokens } from "@martly/shared/types";

type Step = "phone" | "otp" | "name";

export default function LoginScreen() {
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
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
        setAccessToken(result.data.accessToken);
        pendingTokensRef.current = result.data;
        setStep("name");
      } else {
        await login(result.data);
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.inner}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* Branding */}
          <View style={styles.brandSection}>
            <View style={styles.logoRow}>
              <View style={styles.logoBg}>
                <Ionicons name="bicycle" size={32} color="#fff" />
              </View>
            </View>
            <Text style={styles.brandTitle}>Martly Rider</Text>
            <Text style={styles.brandSubtitle}>Deliver. Earn. Repeat.</Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            {/* Phone Step */}
            {step === "phone" && (
              <>
                <Text style={styles.stepTitle}>Sign in with your phone</Text>
                <Text style={styles.stepSubtitle}>We'll send a verification code</Text>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <View style={styles.phoneRow}>
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
              </>
            )}

            {/* OTP Step */}
            {step === "otp" && (
              <>
                <Text style={styles.stepTitle}>Enter verification code</Text>
                <Text style={styles.stepSubtitle}>
                  Sent to{" "}
                  <Text style={styles.phoneHighlight}>+91 {phone}</Text>
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

                <Pressable
                  onPress={() => { setStep("phone"); setOtp(""); setError(""); }}
                  style={styles.linkContainer}
                >
                  <Ionicons name="arrow-back" size={14} color={colors.textSecondary} />
                  <Text style={styles.linkText}> Change number</Text>
                </Pressable>
              </>
            )}

            {/* Name Step */}
            {step === "name" && (
              <>
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
              </>
            )}
          </View>

          {/* Dev hint */}
          {step === "otp" && (
            <View style={styles.devHint}>
              <Ionicons name="information-circle-outline" size={14} color="#94a3b8" />
              <Text style={styles.devHintText}> Use OTP: 111111</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceDarker,
  },
  flex: { flex: 1 },
  inner: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },

  // Branding
  brandSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoRow: {
    marginBottom: 16,
  },
  logoBg: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  brandTitle: {
    fontSize: fontSize.hero,
    fontFamily: fonts.bold,
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: fontSize.body,
    fontFamily: fonts.medium,
    color: colors.textOnDarkSecondary,
    marginTop: 4,
  },

  // Card
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },

  // Steps
  stepTitle: {
    fontSize: fontSize.title,
    fontFamily: fonts.bold,
    color: colors.text,
    textAlign: "center",
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: fontSize.body,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  phoneHighlight: {
    fontFamily: fonts.bold,
    color: colors.text,
  },

  // Phone input
  phoneRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: spacing.md,
  },
  countryCode: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: 16,
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
  countryCodeText: {
    fontSize: fontSize.subtitle,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  phoneInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: 16,
    fontSize: 18,
    fontFamily: fonts.medium,
    color: colors.text,
    letterSpacing: 1,
  },

  // OTP
  otpInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: 16,
    fontSize: 28,
    fontFamily: fonts.bold,
    color: colors.text,
    textAlign: "center",
    letterSpacing: 12,
    marginBottom: spacing.md,
  },

  // Generic input
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: 16,
    fontSize: fontSize.subtitle,
    fontFamily: fonts.regular,
    color: colors.text,
    marginBottom: spacing.md,
  },

  // Button
  button: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: borderRadius.lg,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: "#fff",
    fontSize: fontSize.subtitle,
    fontFamily: fonts.bold,
  },

  error: {
    color: colors.error,
    textAlign: "center",
    marginBottom: spacing.md,
    fontSize: fontSize.sm,
    fontFamily: fonts.medium,
  },

  linkContainer: {
    marginTop: spacing.lg,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  linkText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },

  devHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    opacity: 0.6,
  },
  devHintText: {
    fontSize: fontSize.caption,
    fontFamily: fonts.regular,
    color: "#94a3b8",
  },
});
