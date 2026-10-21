-- How shoppers say things per language, and the catalog word for each: the shopping-list AI's glossary
-- CreateTable
CREATE TABLE "list_glossary_terms" (
    "id" TEXT NOT NULL,
    "search_term" TEXT NOT NULL,
    "note" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "list_glossary_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "list_glossary_phrases" (
    "id" TEXT NOT NULL,
    "term_id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "list_glossary_phrases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "list_glossary_terms_search_term_key" ON "list_glossary_terms"("search_term");

-- CreateIndex
CREATE INDEX "list_glossary_phrases_term_id_idx" ON "list_glossary_phrases"("term_id");

-- CreateIndex
CREATE UNIQUE INDEX "list_glossary_phrases_language_text_key" ON "list_glossary_phrases"("language", "text");

-- AddForeignKey
ALTER TABLE "list_glossary_phrases" ADD CONSTRAINT "list_glossary_phrases_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "list_glossary_terms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

