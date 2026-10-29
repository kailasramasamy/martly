import { useState } from "react";
import { useRouter } from "expo-router";
import { can } from "@martly/shared/permissions";
import { CollectionKindLabels, type CollectionKind } from "@martly/shared/constants";
import { useAuth } from "../../../lib/auth-context";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { ManageListScreen } from "../ManageListScreen";
import { HeaderAction } from "../HeaderAction";
import { ListRow } from "../ui/ListRow";
import { StatusPill } from "../ui/StatusPill";
import { collectionStatus } from "./status";
import type { CollectionRecord } from "./types";

export function CollectionListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const list = usePagedList<CollectionRecord>("/api/v1/collections", { q });
  const canCreate = can(user, "collections", "create");

  return (
    <ManageListScreen
      title="Collections"
      list={list}
      search={{ value: q, onChange: setQ, placeholder: "Search collections" }}
      headerRight={canCreate ? () => <HeaderAction onPress={() => router.push("/manage/collections/new")} accessibilityLabel="New collection" /> : undefined}
      empty={{ icon: "albums-outline", title: "No collections yet", message: canCreate ? "Use + to curate one." : undefined }}
      renderItem={(c) => {
        const status = collectionStatus(c);
        const kind = CollectionKindLabels[c.kind as CollectionKind] ?? c.kind;
        return (
          <ListRow
            title={c.title}
            subtitle={`${c._count.items} products · ${kind}`}
            caption={[c.source === "AGENT" ? "Made by Martly" : null, c.organizationId ? c.organization?.name : "Global"].filter(Boolean).join(" · ")}
            imageUrl={c.imageUrl}
            railColor={status.color}
            trailing={<StatusPill label={status.label} color={status.color} bg={status.bg} />}
            chevron
            onPress={() => router.push(`/manage/collections/${c.id}`)}
          />
        );
      }}
    />
  );
}
