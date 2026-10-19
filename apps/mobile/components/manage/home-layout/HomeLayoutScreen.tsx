import { View, Text, FlatList, Alert, ActivityIndicator, RefreshControl, StyleSheet } from "react-native";
import { Stack, useRouter } from "expo-router";
import { colors, fonts, radius } from "../../../constants/theme";
import { useManageScope } from "../../../lib/manage-scope-context";
import { HeaderAction } from "../HeaderAction";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { manage } from "../ui/tokens";
import { SectionRow } from "./SectionRow";
import { useHomeLayout, useLayoutActions } from "./use-home-layout";
import type { HomeSectionRecord } from "./types";

function DefaultBanner({ onCustomize, running }: { onCustomize: () => void; running: boolean }) {
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerTitle}>Using the default layout</Text>
      <Text style={styles.bannerText}>Customize it to switch sections off, reorder them or add your own. The default stays as it is until you do.</Text>
      <Button label="Customize layout" icon="construct-outline" onPress={onCustomize} loading={running} />
    </View>
  );
}

export function HomeLayoutScreen() {
  const router = useRouter();
  const { store } = useManageScope();
  const { organizationId, org, layout, hidden } = useHomeLayout();
  const actions = useLayoutActions(org, layout);
  const { data, loading, error, reload } = layout;
  const isDefault = data?.isDefault ?? false;

  const confirmDelete = (section: HomeSectionRecord) =>
    Alert.alert("Remove this section?", "It disappears from Home for every store in the organisation.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => actions.remove(section) },
    ]);

  const headerRight = data && !isDefault ? () => <HeaderAction onPress={() => router.push("/manage/home-layout/new")} accessibilityLabel="Add section" /> : undefined;

  if (!organizationId) {
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ title: "Home layout" }} />
        <EmptyState icon="storefront-outline" title="Pick a store" message="Choose a store in the store switcher to edit its organisation's Home layout." />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: "Home layout", headerRight }} />
      {loading ? <ActivityIndicator style={styles.loading} color={colors.primary} size="large" /> : (
        <FlatList
          data={data?.sections ?? []}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={colors.primary} />}
          ListHeaderComponent={isDefault ? <DefaultBanner onCustomize={actions.customize} running={actions.running} /> : null}
          ListEmptyComponent={error ? <EmptyState icon="cloud-offline-outline" title="Couldn't load" message={error} action={{ label: "Try again", onPress: reload }} /> : <EmptyState icon="grid-outline" title="No sections yet" message="Use + to add one." />}
          renderItem={({ item, index }) => (
            <SectionRow
              section={item}
              index={index}
              count={data?.sections.length ?? 0}
              hiddenAt={hidden.has(item.id) ? store?.name : undefined}
              locked={isDefault || actions.running}
              onOpen={() => router.push(`/manage/home-layout/${item.id}`)}
              onToggle={(isActive) => actions.toggle(item, isActive)}
              onMove={(to) => actions.move(index, to)}
              onDelete={() => confirmDelete(item)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: manage.canvas },
  loading: { marginTop: 80 },
  list: { paddingBottom: 32, flexGrow: 1 },
  banner: { margin: 12, padding: 16, gap: 10, borderRadius: radius.lg, backgroundColor: manage.tint, borderWidth: 1, borderColor: manage.line },
  bannerTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  bannerText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
});
