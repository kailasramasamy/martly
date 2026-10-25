import { useEffect, type ReactNode } from "react";
import { View, ScrollView, KeyboardAvoidingView, Platform, RefreshControl, StyleSheet } from "react-native";
import { Loader } from "../Loader";
import { Stack } from "expo-router";
import { colors } from "../../constants/theme";
import { useKeyboardReveal } from "../../lib/use-keyboard-reveal";
import { manage } from "./ui/tokens";
import { EmptyState } from "./ui/EmptyState";
import { StickyActionBar } from "./ui/StickyActionBar";

interface ManageStackScreenProps {
  title: string;
  children: ReactNode;
  /** Buttons pinned to the bottom (Save, Approve, …) */
  actions?: ReactNode;
  headerRight?: () => ReactNode;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Pinned between the header and the scrolling content, e.g. section tabs */
  toolbar?: ReactNode;
  /** Changing this scrolls back to the top, e.g. when a tab switches the content */
  scrollKey?: string;
}

/** Stack-level detail or form screen: native header, keyboard-aware scroll of SectionCards, sticky actions */
export function ManageStackScreen(props: ManageStackScreenProps) {
  const { title, children, actions, headerRight, loading, error, onRetry, refreshing = false, onRefresh, toolbar, scrollKey } = props;
  const keyboard = useKeyboardReveal();
  useEffect(() => keyboard.scrollRef.current?.scrollTo({ y: 0, animated: false }), [scrollKey, keyboard.scrollRef]);
  let body: ReactNode;
  if (loading) body = <Loader style={styles.loading} size="large" />;
  else if (error) body = <EmptyState icon="cloud-offline-outline" title="Couldn't load" message={error} action={onRetry ? { label: "Try again", onPress: onRetry } : undefined} />;
  else body = children;

  return (
    <View ref={keyboard.rootRef} style={styles.root} onLayout={keyboard.onRootLayout}>
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={keyboard.topOffset}>
      <Stack.Screen options={{ title, headerRight }} />
      {toolbar && !loading && !error ? <View style={styles.toolbar}>{toolbar}</View> : null}
      <ScrollView
        keyboardDismissMode="on-drag"
        ref={keyboard.scrollRef}
        onScroll={keyboard.onScroll}
        scrollEventThrottle={32}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
      >
        {body}
      </ScrollView>
      {actions && !loading && !error ? <StickyActionBar>{actions}</StickyActionBar> : null}
    </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: manage.canvas },
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  loading: { marginTop: 80 },
  toolbar: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: manage.line, backgroundColor: manage.canvas },
});
