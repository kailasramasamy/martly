import { useMemo } from "react";
import { View, Text, SectionList, RefreshControl, StyleSheet } from "react-native";
import { Stack, useRouter } from "expo-router";
import type { CreditCampaignRow } from "@martly/shared/types";
import { colors, fonts } from "../../../constants/theme";
import { HeaderAction } from "../../../components/manage/HeaderAction";
import { EmptyState } from "../../../components/manage/ui/EmptyState";
import { ListSkeleton } from "../../../components/manage/ui/ListSkeleton";
import { manage } from "../../../components/manage/ui/tokens";
import { CampaignCard } from "../../../components/manage/credits/CampaignCard";
import { CreditSummary, FunderHeader, StoreInvite } from "../../../components/manage/credits/CreditSections";
import { splitByFunder } from "../../../components/manage/credits/describe";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { useManageScope } from "../../../lib/manage-scope-context";
import { useAuth } from "../../../lib/auth-context";

type Funder = "martly" | "stores";
interface Section { funder: Funder; data: CreditCampaignRow[] }

/** Martly's credit and the stores' own in separate sections, since who pays for it differs */
function useSections(rows: CreditCampaignRow[], isSuperAdmin: boolean): Section[] {
  return useMemo(() => {
    const { martly, stores } = splitByFunder(rows);
    const sections: Section[] = [];
    if (isSuperAdmin || martly.length > 0) sections.push({ funder: "martly", data: martly });
    sections.push({ funder: "stores", data: stores });
    return sections;
  }, [rows, isSuperAdmin]);
}

export default function WelcomeCreditScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { storeId } = useManageScope();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  // The super admin sees Martly's campaigns and every store's, so no store filter there
  const list = usePagedList<CreditCampaignRow>("/api/v1/credits/campaigns", { storeId: isSuperAdmin ? "" : storeId ?? "" }, { pageSize: 50 });
  const sections = useSections(list.items, isSuperAdmin);
  const create = () => router.push("/manage/welcome-credit/new");
  const header = () => <HeaderAction onPress={create} accessibilityLabel="New welcome credit" />;

  if (list.loading) return <View style={styles.root}><Stack.Screen options={{ title: "Welcome credit", headerRight: header }} /><ListSkeleton /></View>;
  if (list.error) {
    return <EmptyState icon="cloud-offline-outline" title="Couldn't load" message={list.error} action={{ label: "Try again", onPress: list.refresh }} />;
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: "Welcome credit", headerRight: header }} />
      <SectionList
        sections={sections}
        keyExtractor={(c) => c.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={list.items.length > 0 ? <CreditSummary rows={list.items} /> : null}
        renderSectionHeader={({ section }) => <FunderHeader funder={section.funder} count={section.data.length} />}
        renderSectionFooter={({ section }) => (section.data.length === 0 ? <SectionEmpty funder={section.funder} onCreate={create} canCreate={isSuperAdmin || !!storeId} /> : null)}
        renderItem={({ item }) => (
          <CampaignCard campaign={item} showStore={isSuperAdmin} onPress={() => router.push(`/manage/welcome-credit/${item.id}`)} />
        )}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={colors.primary} />}
      />
    </View>
  );
}

function SectionEmpty({ funder, onCreate, canCreate }: { funder: Funder; onCreate: () => void; canCreate: boolean }) {
  if (funder === "stores" && canCreate) return <StoreInvite onPress={onCreate} />;
  return (
    <View style={styles.emptyNote}>
      <Text style={styles.emptyText}>{funder === "martly" ? "None running. Use + to give every new customer Martly credit." : "No store offers its own credit yet."}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: manage.canvas },
  content: { padding: 16, paddingBottom: 40 },
  gap: { height: 12 },
  emptyNote: { borderRadius: 12, borderWidth: 1, borderColor: manage.line, backgroundColor: manage.card, padding: 16 },
  emptyText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
});
