import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { useAction } from "../../lib/manage/use-action";
import { usePhoneChange } from "../../lib/use-phone-change";
import { ManageStackScreen } from "../../components/manage/ManageStackScreen";
import { SectionCard } from "../../components/manage/ui/SectionCard";
import { TextField } from "../../components/manage/ui/TextField";
import { Button } from "../../components/manage/ui/Button";
import { KeyValue } from "../../components/manage/ui/KeyValue";
import { colors, fonts } from "../../constants/theme";

/** Current number with Change; a new number is saved only after the code sent to it is verified */
function PhoneSection() {
  const { user } = useAuth();
  const change = usePhoneChange();

  return (
    <SectionCard title="Phone">
      {change.step === "idle" && (
        <View style={styles.row}>
          <Text style={styles.value}>{user?.phone || "No phone added"}</Text>
          <Button label={user?.phone ? "Change" : "Add phone"} variant="secondary" compact onPress={change.start} />
        </View>
      )}
      {change.step === "number" && (
        <TextField label="New mobile number" keyboardType="number-pad" maxLength={15} value={change.phone} onChangeText={change.setPhone} hint="We'll text a code to confirm it's yours" />
      )}
      {change.step === "code" && (
        <TextField label={`Code sent to ${change.phone}`} keyboardType="number-pad" maxLength={6} value={change.code} onChangeText={change.setCode} />
      )}
      {change.step !== "idle" && (
        <View style={styles.actions}>
          <Button label="Cancel" variant="secondary" compact onPress={change.cancel} style={styles.flex} />
          <Button
            label={change.step === "code" ? "Verify & save" : "Send code"}
            compact
            loading={change.busy}
            onPress={change.step === "code" ? change.verify : change.sendCode}
            style={styles.flex}
          />
        </View>
      )}
    </SectionCard>
  );
}

export default function MyProfileScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { run, running } = useAction();
  const [name, setName] = useState(user?.name ?? "");
  useEffect(() => setName(user?.name ?? ""), [user?.name]);
  // Phone sign-ups get a placeholder email, so only real addresses are shown
  const email = user?.email?.endsWith("@phone.martly.app") ? null : user?.email;

  const save = async () => {
    const ok = await run(async () => {
      await api.put("/api/v1/auth/profile", { name: name.trim() });
      await refreshUser();
      return true;
    }, "Profile updated");
    if (ok) router.back();
  };

  return (
    <ManageStackScreen
      title="My profile"
      actions={<Button label="Save changes" onPress={save} loading={running} disabled={!name.trim() || name.trim() === user?.name} style={styles.flex} />}
    >
      <SectionCard title="Details">
        <TextField label="Name" required value={name} onChangeText={setName} />
        <KeyValue label="Login email" value={email} />
        <Text style={styles.hint}>Ask your owner or the platform admin to change your login email.</Text>
      </SectionCard>
      <PhoneSection />
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 44 },
  value: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
  flex: { flex: 1 },
  hint: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
});
