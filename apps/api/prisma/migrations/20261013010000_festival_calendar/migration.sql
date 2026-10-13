-- CreateEnum
CREATE TYPE "CurationSource" AS ENUM ('MANUAL', 'AGENT');

-- AlterTable
ALTER TABLE "collections" ADD COLUMN     "festival_event_id" TEXT,
ADD COLUMN     "source" "CurationSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "translations" JSONB;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "festival_regions" TEXT[] DEFAULT ARRAY['ALL']::TEXT[];

-- CreateTable
CREATE TABLE "festival_events" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "CollectionKind" NOT NULL DEFAULT 'OCCASION',
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "lead_days" INTEGER NOT NULL DEFAULT 7,
    "regions" TEXT[] DEFAULT ARRAY['ALL']::TEXT[],
    "guidance" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "festival_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "festival_events_slug_key" ON "festival_events"("slug");

-- CreateIndex
CREATE INDEX "festival_events_is_active_starts_at_idx" ON "festival_events"("is_active", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "collections_organization_id_festival_event_id_key" ON "collections"("organization_id", "festival_event_id");

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_festival_event_id_fkey" FOREIGN KEY ("festival_event_id") REFERENCES "festival_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

