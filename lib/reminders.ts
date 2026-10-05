import { prisma } from '@/lib/prisma';

/**
 * Invalidate reminders when due date changes
 * This should be called when insurance, inspection, or loan due dates are updated
 */
export async function invalidateOldReminders({
  vehicleId,
  sourceType,
  sourceId,
}: {
  vehicleId: string;
  sourceType: 'InsurancePolicy' | 'AnnualInspection' | 'LoanInstallment';
  sourceId?: string;
}) {
  try {
    // Delete old unconfirmed reminders so they can be recreated with new due date
    await prisma.reminder.deleteMany({
      where: {
        vehicleId,
        sourceType,
        sourceId: sourceId || null,
        status: {
          in: ['PENDING', 'SENT'],
        },
      },
    });
  } catch (error) {
    console.error('Failed to invalidate old reminders:', error);
    // Don't throw error, just log it
  }
}
