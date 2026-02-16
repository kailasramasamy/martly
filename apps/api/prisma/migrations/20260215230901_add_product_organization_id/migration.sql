-- AlterTable
ALTER TABLE "products" ADD COLUMN     "organization_id" TEXT;

-- CreateIndex
CREATE INDEX "products_organization_id_idx" ON "products"("organization_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
