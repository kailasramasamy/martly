-- CreateEnum
CREATE TYPE "CodCollectionMode" AS ENUM ('CASH', 'UPI');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "cod_collected_via" "CodCollectionMode";

