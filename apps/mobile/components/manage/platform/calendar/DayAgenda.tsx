import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { colors, fonts } from "../../../../constants/theme";
import { Button } from "../../ui/Button";
import { ListRow } from "../../ui/ListRow";
import { SectionCard } from "../../ui/SectionCard";
import { StatusPill } from "../../ui/StatusPill";
import { fromDateKey, toDateKey } from "../../ui/dates";
import { manage } from "../../ui/tokens";
import { dateRange, lengthLabel, statusTone } from "../campaigns/campaign-utils";
import type { Campaign } from "../types";
import { campaignColor } from "./package-colors";

interface DayAgendaProps {
  dayKey: string;
  campaigns: Campaign[];
}

export function DayAgenda({ dayKey, campaigns }: DayAgendaProps) {
  const router = useRouter();
  const day = fromDateKey(dayKey);
  const heading = day.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  const count = `${campaigns.length} ${campaigns.length === 1 ? "campaign" : "campaigns"}`;
  const canBook = dayKey >= toDateKey(new Date());

  return (
    <View style={styles.root}>
      <Text style={styles.heading}>{heading} · {count}</Text>
      {campaigns.length ? (
        <SectionCard flush>
          {campaigns.map((c) => {
            const tone = statusTone(c.status);
            return (
              <ListRow
                key={c.id}
                title={c.title}
                subtitle={c.category ? `${c.product.name} · ${c.category.name}` : c.product.name}
                caption={`${dateRange(c)} · ${lengthLabel(c)}`}
                imageUrl={c.brand.imageUrl}
                imageContain
                railColor={campaignColor(c)}
                chevron
                trailing={<StatusPill label={tone.label} color={tone.color} bg={tone.bg} dot={c.status === "LIVE"} />}
                onPress={() => router.push(`/manage/brand-campaigns/${c.id}`)}
              />
            );
          })}
        </SectionCard>
      ) : (
        <Text style={styles.empty}>Nothing running on this day. A free slot.</Text>
      )}
      {canBook && (
        <Button
          label={`Book from ${day.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
          icon="add"
          variant="secondary"
          onPress={() => router.push(`/manage/brand-campaigns/new?startDate=${dayKey}`)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  heading: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  empty: { fontFamily: fonts.medium, fontSize: 13.5, color: manage.muted, paddingVertical: 6 },
});
