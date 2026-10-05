-- Drop purchase/register dates; they are out of scope
ALTER TABLE "Vehicle" DROP COLUMN IF EXISTS "purchaseDate";
ALTER TABLE "Vehicle" DROP COLUMN IF EXISTS "registerDate";
