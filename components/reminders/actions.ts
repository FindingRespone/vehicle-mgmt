'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function confirmReminder(reminderId: string) {
  try {
    const session = await auth();

    if (!session?.user) {
      return { success: false, error: '未登录' };
    }

    const userId = session.user.id;
    const userRole = session.user.role;

    // Fetch the reminder
    const reminder = await prisma.reminder.findUnique({
      where: { id: reminderId },
      include: {
        vehicle: {
          select: {
            id: true,
            ownerId: true,
          },
        },
      },
    });

    if (!reminder) {
      return { success: false, error: '提醒不存在' };
    }

    // Check permissions
    if (userRole === 'SUPER_ADMIN') {
      // Super admin can confirm any reminder
    } else if (userRole === 'ADMIN') {
      // Admin can confirm insurance and inspection reminders only
      if (reminder.sourceType === 'LoanInstallment') {
        return { success: false, error: '无权限处理贷款提醒' };
      }
    } else {
      // Vehicle member can only confirm reminders for their vehicles
      const isMember = await prisma.vehicleMember.findFirst({
        where: {
          vehicleId: reminder.vehicleId,
          userId: userId,
        },
      });

      const isOwner = reminder.vehicle.ownerUserId === userId;

      if (!isMember && !isOwner) {
        return { success: false, error: '无权限处理此提醒' };
      }

      // Vehicle members cannot confirm loan reminders
      if (reminder.sourceType === 'LoanInstallment') {
        return { success: false, error: '无权限处理贷款提醒' };
      }
    }

    // Update reminder status
    await prisma.reminder.update({
      where: { id: reminderId },
      data: {
        status: 'CONFIRMED',
        confirmedBy: userId,
        confirmedAt: new Date(),
        isCompleted: true,
        completedAt: new Date(),
      },
    });

    revalidatePath('/reminders');

    return { success: true };
  } catch (error) {
    console.error('Failed to confirm reminder:', error);
    return { success: false, error: '确认失败' };
  }
}
