import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { colors, fonts } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";
import { BottomSheet } from "../search/BottomSheet";
import { Loader } from "../Loader";

export interface ListSettings {
  reminderDay: number;
  pushOn: boolean;
  whatsappOn: boolean;
  isActive: boolean;
}

// Salary and pension days, plus the month's quarters
const DAYS = [1, 2, 5, 7, 10, 15, 20, 25];
export const DEFAULT_SETTINGS: ListSettings = { reminderDay: 1, pushOn: true, whatsappOn: true, isActive: true };

function Channel({ title, detail, on, onChange }: { title: string; detail: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <View style={styles.channel}>
      <View style={styles.channelText}>
        <Text style={styles.channelTitle}>{title}</Text>
        <Text style={styles.channelDetail}>{detail}</Text>
      </View>
      <Switch value={on} onValueChange={onChange} trackColor={{ true: colors.primary, false: "#cbd5e1" }} thumbColor="#ffffff" accessibilityLabel={title} />
    </View>
  );
}

interface Props {
  visible: boolean;
  /** The settings to start from; the defaults when null */
  initial: ListSettings | null;
  /** Changing an existing list (it can be paused) rather than starting one */
  editing: boolean;
  /** Starting over replaces the list the shopper has at the store */
  replaces: boolean;
  onSave: (settings: ListSettings) => Promise<boolean>;
  onClose: () => void;
}

/** Starting a monthly list or changing its day and reminders */
export function SetupSheet({ visible, initial, editing, replaces, onSave, onClose }: Props) {
  const t = useStrings("monthlyList");
  const [settings, setSettings] = useState<ListSettings>(initial ?? DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (visible) setSettings(initial ?? DEFAULT_SETTINGS);
  }, [visible, initial]);
  const set = (patch: Partial<ListSettings>) => setSettings((s) => ({ ...s, ...patch }));
  const days = DAYS.includes(settings.reminderDay) ? DAYS : [...DAYS, settings.reminderDay].sort((a, b) => a - b);

  const save = async () => {
    setSaving(true);
    const ok = await onSave(settings);
    setSaving(false);
    if (ok) onClose();
  };
  const footer = (
    <TouchableOpacity style={styles.save} onPress={save} disabled={saving} activeOpacity={0.85} accessibilityRole="button">
      {saving ? <Loader size="small" color="#ffffff" /> : <Text style={styles.saveText}>{editing ? t.saveSettings : t.save}</Text>}
    </TouchableOpacity>
  );
  return (
    <BottomSheet visible={visible} title={t.setupTitle} onClose={onClose} footer={footer} scrollable>
      <Text style={styles.body}>{t.setupBody}</Text>
      {replaces && <Text style={styles.note}>{t.replaceNote}</Text>}
      <Text style={styles.label}>{t.remindOn}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
        {days.map((d) => {
          const on = settings.reminderDay === d;
          return (
            <TouchableOpacity key={d} style={[styles.day, on && styles.dayOn]} onPress={() => set({ reminderDay: d })} accessibilityRole="radio" accessibilityState={{ selected: on }}>
              <Text style={[styles.dayText, on && styles.dayTextOn]}>{t.dayLabel(d)}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <Text style={styles.hint}>{t.dayHint}</Text>
      <View style={styles.channels}>
        <Channel title={t.pushTitle} detail={t.pushDetail} on={settings.pushOn} onChange={(pushOn) => set({ pushOn })} />
        <Channel title={t.whatsappTitle} detail={t.whatsappDetail} on={settings.whatsappOn} onChange={(whatsappOn) => set({ whatsappOn })} />
        {editing && <Channel title={t.pause} detail={settings.isActive ? "" : t.paused} on={!settings.isActive} onChange={(paused) => set({ isActive: !paused })} />}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: "#475569" },
  note: { marginTop: 8, fontFamily: fonts.semibold, fontSize: 13, color: "#b45309" },
  label: { marginTop: 20, fontFamily: fonts.extrabold, fontSize: 11, letterSpacing: 0.5, color: colors.textSecondary },
  days: { gap: 8, paddingVertical: 10 },
  day: { minWidth: 52, height: 44, paddingHorizontal: 12, borderRadius: 22, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff" },
  dayOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayText: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.text },
  dayTextOn: { color: "#ffffff" },
  hint: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18, color: colors.textSecondary },
  channels: { marginTop: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  channel: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  channelText: { flex: 1 },
  channelTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  channelDetail: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  save: { height: 52, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  saveText: { fontFamily: fonts.extrabold, fontSize: 16, color: "#ffffff" },
});
