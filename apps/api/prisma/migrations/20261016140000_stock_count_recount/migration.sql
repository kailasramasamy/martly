-- CreateEnum
CREATE TYPE "StockCountRevisionKind" AS ENUM ('COUNT', 'RECOUNT', 'CORRECTION');

-- AlterEnum
ALTER TYPE "StockCountStatus" ADD VALUE 'RECOUNT';

-- AlterTable
ALTER TABLE "stock_count_lines" ADD COLUMN     "applied_at" TIMESTAMP(3),
ADD COLUMN     "recount_qty" INTEGER,
ADD COLUMN     "recount_requested" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "stock_count_line_revisions" (
    "id" TEXT NOT NULL,
    "line_id" TEXT NOT NULL,
    "kind" "StockCountRevisionKind" NOT NULL,
    "qty" INTEGER NOT NULL,
    "reason" TEXT,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_count_line_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_count_line_revisions_line_id_idx" ON "stock_count_line_revisions"("line_id");

-- AddForeignKey
ALTER TABLE "stock_count_line_revisions" ADD CONSTRAINT "stock_count_line_revisions_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "stock_count_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_line_revisions" ADD CONSTRAINT "stock_count_line_revisions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

