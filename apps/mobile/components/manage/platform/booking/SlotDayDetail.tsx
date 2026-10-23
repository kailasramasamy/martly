import { View, Text, Image, StyleSheet } from "react-native";
import { colors, fonts } from "../../../../constants/theme";
import { manage } from "../../ui/tokens";
import { StatusPill } from "../../ui/StatusPill";
import { statusTone } from "../campaigns/campaign-utils";
import type { CalendarCampaign, CalendarDay } from "../types";
import { dayState, istDay, istTime } from "./slot-days";

/** Which side of the day the campaign touches, e.g. "until 29 Oct 04:25" or "from 29 Oct 04:25" */
function span(c: CalendarCampaign, date: string): string {
  const startsDay = new Date(c.startsAt).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const [iso, word] = startsDay === date ? [c.startsAt, "from"] : [c.endsAt, "until"];
  return `${word} ${istDay(iso)} ${istTime(iso)}`;
}

function CampaignRow({ campaign, date }: { campaign: CalendarCampaign; date: string }) {
  const tone = statusTone(campaign.status);
  return (
    <View style={styles.row}>
      {campaign.brand.imageUrl ? <Image source={{ uri: campaign.brand.imageUrl }} style={styles.logo} /> : <View style={styles.logo} />}
      <View style={styles.body}>
        <Text style={styles.brand} numberOfLines={1}>{campaign.brand.name}</Text>
        <Text style={styles.title} numberOfLines={1}>{campaign.title}</Text>
        <Text style={styles.span}>{span(campaign, date)}</Text>
      </View>
      <StatusPill label={tone.label} color={tone.color} bg={tone.bg} />
    </View>
  );
}

/** What the tapped day looks like: when it opens, and who holds it */
export function SlotDayDetail({ day, todayKey }: { day: CalendarDay; todayKey: string }) {
  const state = dayState(day, todayKey);
  const note = state === "full" ? "Fully booked this day" : state === "later" && day.startsAt ? `Opens at ${istTime(day.startsAt)} — the booking starts then` : null;
  return (
    <View style={styles.wrap}>
      {note ? <Text style={[styles.note, state === "full" && styles.noteFull]}>{note}</Text> : null}
      {day.campaigns.length === 0 ? <Text style={styles.span}>No brands booked this day</Text> : null}
      {day.campaigns.map((c) => <CampaignRow key={c.id} campaign={c} date={day.date} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, paddingTop: 12, marginTop: 8, borderTopWidth: 1, borderTopColor: manage.hairline },
  note: { fontFamily: fonts.semibold, fontSize: 13, color: manage.attentionText },
  noteFull: { color: colors.error },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  logo: { width: 40, height: 40, borderRadius: 8, backgroundColor: manage.canvas },
  body: { flex: 1 },
  brand: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  title: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  span: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
});
