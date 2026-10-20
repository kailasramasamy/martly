import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { useStore } from "../lib/store-context";
import { useToast } from "../lib/toast-context";
import { useAccountSummary } from "../lib/use-account-summary";
import { useKeyboardReveal } from "../lib/use-keyboard-reveal";
import { DeletionSummary } from "../components/account/DeletionSummary";
import { colors, fonts } from "../constants/theme";
import { withSignIn } from "../components/SignInPrompt";
import { strings } from "../lib/i18n";
import { useStrings } from "../lib/i18n/use-strings";

type Step = "review" | "confirm";

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function useAccountDeletion() {
  const { logout } = useAuth();
  const toast = useToast();
  const t = useStrings("account").deletion;
  const [step, setStep] = useState<Step>("review");
  const [phone, setPhone] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function requestCode() {
    setError("");
    setLoading(true);
    try {
      const res = await api.post<{ otpRequired: boolean; phone: string | null }>("/api/v1/auth/me/deletion-otp", {});
      setPhone(res.data.phone);
      setStep("confirm");
    } catch (err) {
      setError(errorMessage(err, t.sendFailed));
    } finally {
      setLoading(false);
    }
  }

  async function deleteAccount() {
    if (phone && otp.length !== 6) {
      setError(t.enterSixDigit);
      return;
    }
    setError("");
    setLoading(true);
    try {
      await api.delete("/api/v1/auth/me", phone ? { otp } : {});
      logout();
      router.replace("/(tabs)");
      toast.show(t.deleted, "success");
    } catch (err) {
      setError(errorMessage(err, t.deleteFailed));
      setLoading(false);
    }
  }

  const changeOtp = (text: string) => { setOtp(text.replace(/\D/g, "")); setError(""); };
  return { step, phone, otp, loading, error, changeOtp, submit: step === "review" ? requestCode : deleteAccount };
}

function OtpField({ phone, value, onChange }: { phone: string; value: string; onChange: (text: string) => void }) {
  const t = useStrings("account").deletion;
  return (
    <View style={styles.otpBlock}>
      <Text style={styles.otpLabel}>{t.enterCode(phone)}</Text>
      <TextInput
        style={styles.otpInput}
        value={value}
        onChangeText={onChange}
        placeholder="000000"
        placeholderTextColor="#cbd5e1"
        keyboardType="number-pad"
        maxLength={6}
        textContentType="oneTimeCode"
        autoFocus
      />
    </View>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <View style={styles.errorBox}>
      <Ionicons name="information-circle" size={18} color={colors.error} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

function DeleteAccountScreen() {
  const t = useStrings("account").deletion;
  const { isAuthenticated } = useAuth();
  const { selectedStore } = useStore();
  const summary = useAccountSummary(isAuthenticated, selectedStore?.id);
  const { step, phone, otp, loading, error, changeOtp, submit } = useAccountDeletion();
  const reviewing = step === "review";
  const keyboard = useKeyboardReveal();

  return (
    <View ref={keyboard.rootRef} onLayout={keyboard.onRootLayout} style={{ flex: 1 }}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={keyboard.topOffset}>
      <ScrollView keyboardDismissMode="on-drag" ref={keyboard.scrollRef} onScroll={keyboard.onScroll} scrollEventThrottle={16} style={styles.container} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="person-remove-outline" size={26} color={colors.error} />
          </View>
          <Text style={styles.title}>{t.title}</Text>
          <Text style={styles.subtitle}>{t.subtitle}</Text>
        </View>

        <DeletionSummary walletBalance={summary.walletBalance} loyaltyPoints={summary.loyaltyPoints} isMember={summary.isMember} />
        {!reviewing && phone ? <OtpField phone={phone} value={otp} onChange={changeOtp} /> : null}
        {error ? <ErrorBox message={error} /> : null}

        <TouchableOpacity
          style={[styles.danger, reviewing && styles.dangerOutline, loading && styles.disabled]}
          onPress={submit}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={reviewing ? colors.error : "#fff"} />
          ) : (
            <Text style={[styles.dangerText, reviewing && styles.dangerOutlineText]}>
              {reviewing ? t.continueDelete : t.deleteMine}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.keep} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.keepText}>{t.keep}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { padding: 16, paddingBottom: 48 },
  hero: { alignItems: "center", paddingTop: 8, paddingHorizontal: 12 },
  heroIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: "#fef2f2",
    alignItems: "center", justifyContent: "center", marginBottom: 14,
  },
  title: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.text, letterSpacing: 0 },
  subtitle: {
    fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.textSecondary,
    textAlign: "center", marginTop: 6, letterSpacing: 0,
  },
  otpBlock: { marginTop: 24 },
  otpLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text, marginBottom: 10, letterSpacing: 0 },
  otpInput: {
    height: 56, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, backgroundColor: "#fff",
    fontFamily: fonts.bold, fontSize: 22, letterSpacing: 8, textAlign: "center", color: colors.text,
  },
  errorBox: {
    flexDirection: "row", gap: 8, alignItems: "flex-start", marginTop: 16,
    backgroundColor: "#fef2f2", borderRadius: 12, padding: 12,
  },
  errorText: { flex: 1, fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: "#b91c1c", letterSpacing: 0 },
  danger: {
    height: 52, borderRadius: 14, backgroundColor: colors.error, marginTop: 24,
    alignItems: "center", justifyContent: "center",
  },
  dangerOutline: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#fecaca" },
  disabled: { opacity: 0.6 },
  dangerText: { fontFamily: fonts.bold, fontSize: 15, color: "#fff", letterSpacing: 0 },
  dangerOutlineText: { color: colors.error },
  keep: { height: 48, alignItems: "center", justifyContent: "center", marginTop: 8 },
  keepText: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary, letterSpacing: 0 },
});

export default withSignIn(DeleteAccountScreen, "person-outline", () => strings("account").signIn.deleteAccount);
