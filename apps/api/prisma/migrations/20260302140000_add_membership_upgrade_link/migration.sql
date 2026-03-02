-- AlterTable
ALTER TABLE "user_memberships" ADD COLUMN "previous_membership_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "user_memberships_previous_membership_id_key" ON "user_memberships"("previous_membership_id");

-- AddForeignKey
ALTER TABLE "user_memberships" ADD CONSTRAINT "user_memberships_previous_membership_id_fkey" FOREIGN KEY ("previous_membership_id") REFERENCES "user_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;
