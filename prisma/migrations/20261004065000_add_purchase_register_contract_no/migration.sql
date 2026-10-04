-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN "purchaseDate" TIMESTAMP(3);
ALTER TABLE "Vehicle" ADD COLUMN "registerDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Loan" ADD COLUMN "contractNo" TEXT;
