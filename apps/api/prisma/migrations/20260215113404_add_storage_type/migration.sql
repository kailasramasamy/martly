-- CreateEnum
CREATE TYPE "StorageType" AS ENUM ('AMBIENT', 'REFRIGERATED', 'DEEP_CHILLED', 'FROZEN', 'COOL_DRY', 'HUMIDITY_CONTROLLED');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "storage_type" "StorageType";
