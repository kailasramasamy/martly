import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { SegmentedTabs } from "../../../components/manage/ui/SegmentedTabs";
import { CampaignsTab } from "../../../components/manage/marketing/notifications/CampaignsTab";
import { DashboardTab } from "../../../components/manage/marketing/notifications/DashboardTab";
import { SendTab } from "../../../components/manage/marketing/notifications/SendTab";
import { TemplatesTab } from "../../../components/manage/marketing/notifications/TemplatesTab";
import { NOTIFICATION_TABS, type NotificationTab } from "../../../components/manage/marketing/notifications/types";

export default function PushNotificationsScreen() {
  const [tab, setTab] = useState<NotificationTab>("send");
  const tabs = <SegmentedTabs options={NOTIFICATION_TABS} value={tab} onChange={setTab} />;

  return (
    <>
      <View style={tab === "send" ? styles.fill : styles.hidden}><SendTab tabs={tabs} /></View>
      {tab === "campaigns" ? <CampaignsTab tabs={tabs} /> : null}
      {tab === "templates" ? <TemplatesTab tabs={tabs} /> : null}
      {tab === "dashboard" ? <DashboardTab tabs={tabs} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { display: "none" },
});
