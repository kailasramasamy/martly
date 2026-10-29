import { useState } from "react";
import { useRouter } from "expo-router";
import type { Town } from "@martly/shared/types";
import { usePagedList } from "../../../../lib/manage/use-paged-list";
import { ManageListScreen } from "../../ManageListScreen";
import { HeaderAction } from "../../HeaderAction";
import { ListRow } from "../../ui/ListRow";

export function TownsList() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const list = usePagedList<Town>("/api/v1/towns", { q: q.trim() || undefined });

  return (
    <ManageListScreen
      title="Towns"
      list={list}
      search={{ value: q, onChange: setQ, placeholder: "Search towns" }}
      headerRight={() => <HeaderAction accessibilityLabel="New town" onPress={() => router.push("/manage/towns/new")} />}
      empty={{ icon: "location-outline", title: q ? "No matching towns" : "No towns yet", message: q ? undefined : "Add the towns your stores are in." }}
      renderItem={(t) => (
        <ListRow
          title={t.name}
          subtitle={`${t.district}, ${t.state}`}
          caption={`/${t.slug}`}
          chevron
          onPress={() => router.push({ pathname: "/manage/towns/[id]", params: { id: t.id } })}
        />
      )}
    />
  );
}
