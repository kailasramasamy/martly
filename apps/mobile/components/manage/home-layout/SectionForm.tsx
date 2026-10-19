import { useState } from "react";
import { Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { HomeSectionTypeLabels, SECTION_COLLECTION, type HomeSectionType } from "@martly/shared/constants";
import { api } from "../../../lib/api";
import { toQuery } from "../../../lib/manage/query";
import { useAction } from "../../../lib/manage/use-action";
import { useManageScope } from "../../../lib/manage-scope-context";
import { useToast } from "../../../lib/toast-context";
import { colors, fonts } from "../../../constants/theme";
import { ManageStackScreen } from "../ManageStackScreen";
import { Button } from "../ui/Button";
import { SectionCard } from "../ui/SectionCard";
import { SelectField } from "../ui/SelectField";
import { SwitchRow } from "../ui/SwitchRow";
import { TextField } from "../ui/TextField";
import { CollectionField } from "./CollectionField";
import { ConfigFields } from "./ConfigFields";
import { buildSection, CONFIG_TYPES, CREATABLE_TYPES, emptyForm, sectionToForm, type FormValues } from "./form";
import type { HomeSectionRecord } from "./types";

const BASE = "/api/v1/home-layout";
const TYPE_OPTIONS = CREATABLE_TYPES.map((value) => ({ value, label: HomeSectionTypeLabels[value] }));

function useSaveSection(section?: HomeSectionRecord) {
  const router = useRouter();
  const toast = useToast();
  const { organizationId } = useManageScope();
  const { run, running } = useAction();
  const org = toQuery({ organizationId });
  const [values, setValues] = useState<FormValues>(() => (section ? sectionToForm(section) : emptyForm()));
  const patch = (next: Partial<FormValues>) => setValues((prev) => ({ ...prev, ...next }));

  const save = async () => {
    const built = buildSection(values, section);
    if ("error" in built) return toast.show(built.error, "error");
    const { body, items } = built;
    const saved = await run(async () => {
      if (section) {
        await api.patch(`${BASE}/${section.id}${org}`, body);
        return section.id;
      }
      return (await api.post<{ id: string }>(`${BASE}${org}`, { ...body, type: values.type })).data.id;
    });
    if (!saved) return;
    // Tabs are separate rows; a failure here leaves the section saved, so reopen it to retry
    const tabsSaved = !items || (await run(() => api.put(`${BASE}/${saved}/items${org}`, { items })));
    if (tabsSaved) toast.show("Section saved", "success");
    router.replace(tabsSaved ? "/manage/home-layout" : `/manage/home-layout/${saved}`);
  };

  return { values, patch, save, running };
}

export function SectionForm({ section }: { section?: HomeSectionRecord }) {
  const { values, patch, save, running } = useSaveSection(section);
  const type = values.type as HomeSectionType | null;
  const mode = type ? SECTION_COLLECTION[type] : undefined;
  const hasSettings = !!type && CONFIG_TYPES.includes(type);

  return (
    <ManageStackScreen
      title={section ? "Edit section" : "New section"}
      actions={<Button label={section ? "Save changes" : "Add section"} onPress={save} loading={running} disabled={!type} />}
    >
      <SectionCard title="Section">
        {section ? <Text style={styles.type}>{type ? HomeSectionTypeLabels[type] : section.type}</Text> : (
          <SelectField label="Type" required value={type} options={TYPE_OPTIONS} placeholder="Choose a section type" onChange={(next) => patch({ type: next as HomeSectionType })} />
        )}
        <TextField label="Title" value={values.title} onChangeText={(title) => patch({ title })} maxLength={80} />
        <TextField label="Subtitle" value={values.subtitle} onChangeText={(subtitle) => patch({ subtitle })} maxLength={120} />
        {mode ? (
          <CollectionField
            required={mode === "REQUIRED"}
            value={values.collectionId}
            onChange={(collectionId) => patch({ collectionId })}
            hint={mode === "OPTIONAL" ? "Leave empty to use the whole store, or narrow to a collection" : undefined}
          />
        ) : null}
        <SwitchRow label="Active" value={values.isActive} onValueChange={(isActive) => patch({ isActive })} />
      </SectionCard>
      {hasSettings ? <SectionCard title="Settings"><ConfigFields values={values} patch={patch} /></SectionCard> : null}
      {type && !hasSettings ? <Text style={styles.note}>{type === "CAMPAIGN_CARD" ? "More settings in the admin panel" : "Built-in block: it fills itself from store data"}</Text> : null}
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  type: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary, marginBottom: 14 },
  note: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, textAlign: "center" },
});
