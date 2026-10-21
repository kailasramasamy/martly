-- Spoken or written lists turned into carts: input, matches offered, what the customer kept
-- CreateEnum
CREATE TYPE "CartBuilderSource" AS ENUM ('VOICE', 'LIST', 'PHOTO', 'WHATSAPP');

-- CreateTable
CREATE TABLE "cart_builder_runs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "source" "CartBuilderSource" NOT NULL,
    "input_text" TEXT NOT NULL,
    "lines" JSONB NOT NULL,
    "matched_count" INTEGER NOT NULL,
    "pick_count" INTEGER NOT NULL,
    "not_found_count" INTEGER NOT NULL,
    "chosen" JSONB,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_builder_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cart_builder_runs_store_id_created_at_idx" ON "cart_builder_runs"("store_id", "created_at");

-- CreateIndex
CREATE INDEX "cart_builder_runs_user_id_created_at_idx" ON "cart_builder_runs"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "cart_builder_runs" ADD CONSTRAINT "cart_builder_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_builder_runs" ADD CONSTRAINT "cart_builder_runs_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

