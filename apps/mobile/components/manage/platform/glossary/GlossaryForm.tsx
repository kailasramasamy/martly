import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { listGlossaryTermSchema } from "@martly/shared/schemas";
import type { ListGlossaryTerm } from "@martly/shared/types";
import { api } from "../../../../lib/api";
import { useAction } from "../../../../lib/manage/use-action";
import { useResource } from "../../../../lib/manage/use-resource";
import { ManageStackScreen } from "../../ManageStackScreen";
import { SectionCard } from "../../ui/SectionCard";
import { TextField } from "../../ui/TextField";
import { SwitchRow } from "../../ui/SwitchRow";
import { Button } from "../../ui/Button";
import { DeleteButton } from "../../marketing/common";
import { PhraseRows, newPhrase, type PhraseDraft } from "./PhraseRows";

interface FormState { searchTerm: string; note: string; isActive: boolean; phrases: PhraseDraft[] }

const blank = (): FormState => ({ searchTerm: "", note: "", isActive: true, phrases: [newPhrase()] });

type Errors = { searchTerm?: string; note?: string; phrases?: string };

// The API lowercases and validates; trimming here keeps blank notes from being stored as empty strings
const toPayload = (f: FormState) => ({
  searchTerm: f.searchTerm.trim().toLowerCase(),
  note: f.note.trim() || null,
  isActive: f.isActive,
  phrases: f.phrases.map((p) => ({ language: p.language, text: p.text.trim() })),
});

function validate(f: FormState): Errors {
  const parsed = listGlossaryTermSchema.safeParse(toPayload(f));
  if (parsed.success) return {};
  const errors: Errors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] === "phrases" || issue.path[0] === "searchTerm" || issue.path[0] === "note" ? issue.path[0] : "phrases";
    errors[field] ??= field === "phrases" ? "Add at least one phrase, each with its text" : issue.message;
  }
  return errors;
}

const fromTerm = (t: ListGlossaryTerm): FormState => ({
  searchTerm: t.searchTerm,
  note: t.note ?? "",
  isActive: t.isActive,
  phrases: t.phrases.map((p) => ({ key: p.id, language: p.language, text: p.text })),
});

/** Create when `id` is absent, edit otherwise */
export function GlossaryForm({ id }: { id?: string }) {
  const router = useRouter();
  const term = useResource<ListGlossaryTerm>(id ? `/api/v1/list-glossary/${id}` : null);
  const { run, running } = useAction();
  const [f, setF] = useState(blank);
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    if (term.data) setF(fromTerm(term.data));
  }, [term.data]);

  const set = <K extends keyof FormState>(key: K) => (value: FormState[K]) => setF((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    const found = validate(f);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const body = toPayload(f);
    const saved = await run(() => (id ? api.put(`/api/v1/list-glossary/${id}`, body) : api.post("/api/v1/list-glossary", body)), id ? "Term saved" : "Term added");
    if (saved) router.back();
  };

  const remove = async () => {
    if (await run(() => api.delete(`/api/v1/list-glossary/${id}`), "Term deleted")) router.back();
  };

  return (
    <ManageStackScreen
      title={id ? "Edit glossary term" : "New glossary term"}
      loading={term.loading}
      error={term.error}
      onRetry={term.reload}
      actions={
        <>
          {id ? <DeleteButton title="Delete this term?" message="Shopping lists stop using its phrases." running={running} onConfirm={remove} /> : null}
          <Button label={id ? "Save term" : "Add term"} onPress={save} loading={running} style={{ flex: 1 }} />
        </>
      }
    >
      <SectionCard title="Glossary term">
        <TextField label="Catalog word" required value={f.searchTerm} onChangeText={set("searchTerm")} maxLength={60} autoCapitalize="none" hint="The word products are listed under, e.g. besan" error={errors.searchTerm} />
        <TextField label="Note" value={f.note} onChangeText={set("note")} maxLength={120} hint="Anything shopping lists should know, e.g. raw gram flour, never roasted" error={errors.note} />
        <SwitchRow label="Active" value={f.isActive} onValueChange={set("isActive")} />
      </SectionCard>
      <SectionCard title="Phrases">
        <PhraseRows phrases={f.phrases} onChange={set("phrases")} error={errors.phrases} />
      </SectionCard>
    </ManageStackScreen>
  );
}
