-- Rebuild VehicleClass: keep OTHER, map all previous truck-like values to TRUCK, add SEDAN/MPV.
CREATE TYPE "VehicleClass_new" AS ENUM ('TRUCK', 'SEDAN', 'MPV', 'OTHER');

ALTER TABLE "Vehicle"
  ALTER COLUMN "vehicleClass" TYPE "VehicleClass_new"
  USING (
    CASE
      WHEN "vehicleClass" IS NULL THEN NULL
      WHEN "vehicleClass"::text = 'OTHER' THEN 'OTHER'::"VehicleClass_new"
      ELSE 'TRUCK'::"VehicleClass_new"
    END
  );

DROP TYPE "VehicleClass";
ALTER TYPE "VehicleClass_new" RENAME TO "VehicleClass";
