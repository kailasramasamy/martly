import type { ReactNode } from "react";
import { View, ScrollView, RefreshControl, StyleSheet } from "react-native";
import { colors } from "../../constants/theme";
import { ManageHeader } from "./ManageHeader";
import { manage } from "./ui/tokens";
import { useTabBarAutoHide } from "../../lib/tab-bar-visibility";

interface ManageScreenProps {
  title: string;
  children: ReactNode;
  headerSubtitle?: string;
  headerContent?: ReactNode;
  headerRight?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Height of a footer docked above the tab bar, so the content scrolls clear of it */
  dockHeight?: number;
}

/** Tab-level screen: ink header band over a scrolling canvas */
export function ManageScreen({ title, children, headerSubtitle, headerContent, headerRight, refreshing = false, onRefresh, dockHeight = 0 }: ManageScreenProps) {
  const tabBarScroll = useTabBarAutoHide();
  return (
    <View style={styles.root}>
      <ManageHeader title={title} subtitle={headerSubtitle} right={headerRight} collapsed={tabBarScroll.headerCollapsed}>{headerContent}</ManageHeader>
      <ScrollView {...tabBarScroll.scrollProps}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={tabBarScroll.contentStyle(styles.content, dockHeight)}
        showsVerticalScrollIndicator={false}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: manage.canvas },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
});
