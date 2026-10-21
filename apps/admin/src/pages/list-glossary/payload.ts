export interface GlossaryFormValues {
  searchTerm: string;
  note?: string | null;
  isActive: boolean;
  phrases: { language: string; text: string }[];
}

// The API lowercases and validates; trimming here keeps blank notes from being stored as empty strings
export const toGlossaryPayload = (values: GlossaryFormValues) => ({
  searchTerm: values.searchTerm.trim().toLowerCase(),
  note: values.note?.trim() || null,
  isActive: values.isActive,
  phrases: values.phrases.map((p) => ({ language: p.language, text: p.text.trim() })),
});
