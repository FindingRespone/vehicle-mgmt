-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'CONFIRMED', 'SKIPPED');

-- AlterTable
ALTER TABLE "Reminder" ADD COLUMN IF NOT EXISTS "sourceType" TEXT NOT NULL DEFAULT 'Manual';
ALTER TABLE "Reminder" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;
ALTER TABLE "Reminder" ADD COLUMN IF NOT EXISTS "remindAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Reminder" ADD COLUMN IF NOT EXISTS "offsetDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Reminder" ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'inbox';
ALTER TABLE "Reminder" ADD COLUMN IF NOT EXISTS "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Reminder" ADD COLUMN IF NOT EXISTS "payload" TEXT;
ALTER TABLE "Reminder" ADD COLUMN IF NOT EXISTS "confirmedBy" TEXT;
ALTER TABLE "Reminder" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);
ALTER TABLE "Reminder" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Reminder_remindAt_status_idx" ON "Reminder"("remindAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Reminder_vehicleId_sourceType_sourceId_offsetDays_channel_key" ON "Reminder"("vehicleId", "sourceType", "sourceId", "offsetDays", "channel");
