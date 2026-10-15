import { useState, type ReactNode } from "react";
import { useRouter } from "expo-router";
import { ManageListScreen } from "../../ManageListScreen";
import { HeaderAction } from "../../HeaderAction";
import { ListRow } from "../../ui/ListRow";
import { usePagedList } from "../../../../lib/manage/use-paged-list";
import type { Template } from "./types";

export function TemplatesTab({ tabs }: { tabs: ReactNode }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const list = usePagedList<Template>("/api/v1/notifications/admin/templates", { q });

  return (
    <ManageListScreen
      title="Push notifications"
      list={list}
      search={{ value: q, onChange: setQ, placeholder: "Search templates" }}
      filters={tabs}
      headerRight={() => <HeaderAction onPress={() => router.push("/manage/notification-send/templates/new")} accessibilityLabel="New template" />}
      empty={{ icon: "document-text-outline", title: "No templates", message: "Save reusable messages to send faster." }}
      renderItem={(t) => (
        <ListRow
          title={t.name}
          subtitle={t.title}
          caption={t.body}
          imageUrl={t.imageUrl ?? undefined}
          onPress={() => router.push(`/manage/notification-send/templates/${t.id}`)}
          chevron
        />
      )}
    />
  );
}
