import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../lib/auth-context";
import { api } from "../lib/api";
import { colors, spacing, fontSize } from "../constants/theme";
import type { AuthTokens } from "@martly/shared/types";

interface AuthGateProps {
  visible: boolean;
  onAuthenticated: () => void;
  onDismiss: () => void;
  title?: string;
  subtitle?: string;
}

type Step = "phone" | "otp" | "name";

export function AuthGate({
  visible,
  onAuthenticated,
  onDismiss,
  title = "Sign in to continue",
  subtitle = "Enter your phone number to proceed",
}: AuthGateProps) {
  const { login, refreshUser } = useAuth();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const otpRef = useRef<TextInput>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setStep("phone");
      setPhone("");
      setOtp("");
      setName("");
      setError("");
      setLoading(false);
    }
  }, [visible]);

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
      await login(result.data);
      if (result.data.isNewUser) {
        setStep("name");
      } else {
        onAuthenticated();
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
      await refreshUser();
      onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save name");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onDismiss} />

        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Close */}
          <TouchableOpacity style={styles.closeBtn} onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Phone Step */}
          {step === "phone" && (
            <>
              <View style={styles.iconRow}>
                <View style={styles.iconCircle}>
                  <Ionicons name="phone-portrait-outline" size={24} color={colors.primary} />
                </View>
              </View>
              <Text style={styles.sheetTitle}>{title}</Text>
              <Text style={styles.sheetSubtitle}>{subtitle}</Text>

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

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSendOtp}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>Send OTP</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* OTP Step */}
          {step === "otp" && (
            <>
              <View style={styles.iconRow}>
                <View style={styles.iconCircle}>
                  <Ionicons name="keypad-outline" size={24} color={colors.primary} />
                </View>
              </View>
              <Text style={styles.sheetTitle}>Enter verification code</Text>
              <Text style={styles.sheetSubtitle}>
                Sent to <Text style={{ fontWeight: "700", color: colors.text }}>+91 {phone}</Text>
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

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleVerifyOtp}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>Verify & Continue</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { setStep("phone"); setOtp(""); setError(""); }}
                style={styles.changeLink}
              >
                <Text style={styles.changeLinkText}>Change number</Text>
              </TouchableOpacity>

              <View style={styles.devHint}>
                <Ionicons name="information-circle-outline" size={13} color="#94a3b8" />
                <Text style={styles.devHintText}>Use OTP: 111111</Text>
              </View>
            </>
          )}

          {/* Name Step */}
          {step === "name" && (
            <>
              <View style={styles.iconRow}>
                <View style={styles.iconCircle}>
                  <Ionicons name="person-outline" size={24} color={colors.primary} />
                </View>
              </View>
              <Text style={styles.sheetTitle}>What's your name?</Text>
              <Text style={styles.sheetSubtitle}>Let us know what to call you</Text>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TextInput
                style={styles.nameInput}
                placeholder="Your name"
                placeholderTextColor="#94a3b8"
                value={name}
                onChangeText={(t) => { setName(t); setError(""); }}
                autoCapitalize="words"
                autoFocus
              />

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSaveName}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>Continue</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    paddingTop: 12,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "#e2e8f0",
    alignSelf: "center", marginBottom: 16,
  },
  closeBtn: { position: "absolute", top: 16, right: 16, zIndex: 1 },

  iconRow: { alignItems: "center", marginBottom: 12 },
  iconCircle: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: colors.primary + "14",
    justifyContent: "center", alignItems: "center",
  },
  sheetTitle: { fontSize: 20, fontWeight: "700", color: colors.text, textAlign: "center" },
  sheetSubtitle: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: "center", marginTop: 4, marginBottom: 20 },

  phoneRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  countryCode: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 16, justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
  countryCodeText: { fontSize: fontSize.lg, fontWeight: "600", color: colors.text },
  phoneInput: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    padding: 14, fontSize: 18, fontWeight: "500", color: colors.text,
    letterSpacing: 1,
  },

  otpInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    padding: 14, fontSize: 28, fontWeight: "700", color: colors.text,
    textAlign: "center", letterSpacing: 12,
    marginBottom: 16,
  },

  nameInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    padding: 14, fontSize: fontSize.lg, color: colors.text,
    marginBottom: 16,
  },

  button: {
    backgroundColor: colors.primary, padding: 16,
    borderRadius: 12, alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: fontSize.lg, fontWeight: "700" },

  error: { color: colors.error, textAlign: "center", marginBottom: 12, fontSize: fontSize.md },

  changeLink: { alignItems: "center", marginTop: 16 },
  changeLinkText: { fontSize: fontSize.md, color: colors.primary, fontWeight: "600" },

  devHint: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, marginTop: 12, opacity: 0.6,
  },
  devHintText: { fontSize: 12, color: "#94a3b8" },
});
