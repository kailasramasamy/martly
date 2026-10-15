import { View, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { manage } from "../ui/tokens";
import { EmptyState } from "../ui/EmptyState";

type Notice = "denied" | "no-store";

const COPY: Record<Notice, { icon: "lock-closed-outline" | "storefront-outline"; title: string; message: string }> = {
  denied: { icon: "lock-closed-outline", title: "No access", message: "Your role can't use this section. Ask an organization admin." },
  "no-store": { icon: "storefront-outline", title: "No stores yet", message: "Create a store first, then come back to configure it." },
};

/** Full-screen stand-in for permission-denied and no-store states */
export function ScreenNotice({ title, kind }: { title: string; kind: Notice }) {
  const copy = COPY[kind];
  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title }} />
      <EmptyState icon={copy.icon} title={copy.title} message={copy.message} />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: manage.canvas, justifyContent: "center" } });
