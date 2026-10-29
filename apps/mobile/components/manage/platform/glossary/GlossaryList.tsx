import { useState } from "react";
import { Text, Switch, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import type { ListGlossaryTerm } from "@martly/shared/types";
import { api } from "../../../../lib/api";
import { useAction } from "../../../../lib/manage/use-action";
import { usePagedList } from "../../../../lib/manage/use-paged-list";
import { colors, fonts } from "../../../../constants/theme";
import { ManageListScreen } from "../../ManageListScreen";
import { HeaderAction } from "../../HeaderAction";
import { ListRow } from "../../ui/ListRow";
import { SegmentedTabs } from "../../ui/SegmentedTabs";
import { manage } from "../../ui/tokens";
import { LANGUAGE_OPTIONS } from "./languages";

const LANGUAGE_FILTERS = [{ value: "", label: "All languages" }, ...LANGUAGE_OPTIONS];

const phraseLine = (t: ListGlossaryTerm) => t.phrases.map((p) => `${p.language.toUpperCase()} ${p.text}`).join(" · ");

export function GlossaryList() {
  const router = useRouter();
  const { run } = useAction();
  const [q, setQ] = useState("");
  const [language, setLanguage] = useState("");
  const list = usePagedList<ListGlossaryTerm>("/api/v1/list-glossary", { q: q.trim() || undefined, language: language || undefined });

  const toggle = async (term: ListGlossaryTerm, isActive: boolean) => {
    if (await run(() => api.patch(`/api/v1/list-glossary/${term.id}`, { isActive }))) list.updateItem(term.id, { isActive });
  };

  return (
    <ManageListScreen
      title="List glossary"
      list={list}
      search={{ value: q, onChange: setQ, placeholder: "Search catalog word or phrase" }}
      filters={
        <>
          <Text style={styles.intro}>How shoppers say things in their language, and the word our catalog uses. Shopping lists use these.</Text>
          <SegmentedTabs options={LANGUAGE_FILTERS} value={language} onChange={setLanguage} />
        </>
      }
      headerRight={() => <HeaderAction accessibilityLabel="New glossary term" onPress={() => router.push("/manage/list-glossary/new")} />}
      empty={{ icon: "language-outline", title: q || language ? "No matching terms" : "No glossary terms yet", message: q || language ? undefined : "Add the words shoppers use for catalog items." }}
      renderItem={(t) => (
        <ListRow
          title={t.searchTerm}
          subtitle={phraseLine(t)}
          caption={t.note ?? undefined}
          trailing={<Switch value={t.isActive} onValueChange={(v) => toggle(t, v)} trackColor={{ true: colors.primary, false: manage.line }} accessibilityLabel={`${t.searchTerm} active`} />}
          onPress={() => router.push({ pathname: "/manage/list-glossary/[id]", params: { id: t.id } })}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  intro: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
});
