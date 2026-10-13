-- CreateEnum
CREATE TYPE "CollectionKind" AS ENUM ('STANDARD', 'OCCASION', 'SEASON');

-- AlterTable
ALTER TABLE "collections" ADD COLUMN     "ends_at" TIMESTAMP(3),
ADD COLUMN     "kind" "CollectionKind" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "starts_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "search_logs" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "user_id" TEXT,
    "query" TEXT NOT NULL,
    "result_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "search_logs_store_id_created_at_idx" ON "search_logs"("store_id", "created_at");

-- AddForeignKey
ALTER TABLE "search_logs" ADD CONSTRAINT "search_logs_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_logs" ADD CONSTRAINT "search_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

