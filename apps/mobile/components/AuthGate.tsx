import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Loader } from "./Loader";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "../lib/auth-context";
import { api } from "../lib/api";
import { colors, spacing, fontSize } from "../constants/theme";
import type { AuthTokens } from "@martly/shared/types";
import { useStrings } from "../lib/i18n/use-strings";

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
  title,
  subtitle,
}: AuthGateProps) {
  const t = useStrings("auth");
  const common = useStrings("common");
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
      setError(t.errors.invalidPhone);
      return;
    }
    setError("");
    setLoading(true);
    try {
      await api.post("/api/v1/auth/send-otp", { phone: cleaned });
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.sendOtpFailed);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (otp.length !== 6) {
      setError(t.errors.enterOtp);
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
      setError(err instanceof Error ? err.message : t.errors.invalidOtp);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveName() {
    if (!name.trim()) {
      setError(t.errors.enterName);
      return;
    }
    setError("");
    setLoading(true);
    try {
      await api.put("/api/v1/auth/profile", { name: name.trim() });
      await refreshUser();
      onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.saveNameFailed);
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
              <Text style={styles.sheetTitle}>{title ?? t.gate.defaultTitle}</Text>
              <Text style={styles.sheetSubtitle}>{subtitle ?? t.gate.defaultSubtitle}</Text>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={styles.phoneRow}>
                <View style={styles.countryCode}>
                  <Text style={styles.countryCodeText}>+91</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  placeholder={t.login.phonePlaceholder}
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
                  <Loader color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>{t.gate.sendOtp}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.staffLink} onPress={() => { onDismiss(); router.push("/(auth)/staff-login"); }} accessibilityRole="link">
                <Ionicons name="briefcase-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.staffText}>{t.login.staffQuestion} <Text style={styles.staffStrong}>{t.login.staffLogin}</Text></Text>
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
              <Text style={styles.sheetTitle}>{t.gate.otpTitle}</Text>
              <Text style={styles.sheetSubtitle}>
                {t.gate.sentTo} <Text style={{ fontWeight: "700", color: colors.text }}>+91 {phone}</Text>
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
                  <Loader color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>{t.gate.verifyContinue}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { setOtp(""); handleSendOtp(); }}
                disabled={loading}
                style={styles.changeLink}
              >
                <Text style={styles.changeLinkText}>{t.login.resend}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { setStep("phone"); setOtp(""); setError(""); }}
                style={styles.changeLink}
              >
                <Text style={styles.changeLinkText}>{t.login.changeNumber}</Text>
              </TouchableOpacity>
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
              <Text style={styles.sheetTitle}>{t.login.nameTitle}</Text>
              <Text style={styles.sheetSubtitle}>{t.login.nameSubtitle}</Text>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TextInput
                style={styles.nameInput}
                placeholder={t.login.namePlaceholder}
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
                  <Loader color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>{common.continue}</Text>
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
  staffLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12, minHeight: 44 },
  staffText: { fontSize: fontSize.md, color: colors.textSecondary },
  staffStrong: { color: colors.primary, fontWeight: "700" },
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
});
