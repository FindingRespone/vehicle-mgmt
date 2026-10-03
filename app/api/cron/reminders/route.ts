import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateAllVehiclesAvailability } from '@/lib/availability';

interface ReminderToCreate {
  vehicleId: string;
  sourceType: string;
  sourceId: string | null;
  title: string;
  description: string;
  dueDate: Date;
  remindAt: Date;
  offsetDays: number;
  channel: string;
  payload?: string;
}

export async function POST(request: Request) {
  try {
    // Verify CRON_SECRET
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('CRON_SECRET not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = new Date();
    const remindersToCreate: ReminderToCreate[] = [];

    // Helper function to calculate remind date
    const getRemindDate = (dueDate: Date, offsetDays: number): Date => {
      const remindDate = new Date(dueDate);
      remindDate.setDate(remindDate.getDate() - offsetDays);
      return remindDate;
    };

    // Helper function to check if we should create reminder for this offset
    const shouldCreateReminder = (dueDate: Date, offsetDays: number): boolean => {
      const daysToDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      // Create reminder if:
      // 1. We're at or past the remind threshold
      // 2. And we haven't sent this specific reminder yet (handled by upsert)
      if (offsetDays === 0) {
        // Overdue case: create if already past due date
        return daysToDue < 0;
      } else {
        // Future reminder: create if we're within the offset window
        return daysToDue <= offsetDays && daysToDue >= 0;
      }
    };

    // 1. Scan Insurance Policies
    const policies = await prisma.insurancePolicy.findMany({
      include: {
        vehicle: {
          select: {
            id: true,
            plateNo: true,
            owner: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    for (const policy of policies) {
      const dueDate = new Date(policy.endDate);
      const daysToDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Check for 30, 15, 7 days before and overdue (0)
      const offsets = [30, 15, 7];
      
      for (const offset of offsets) {
        if (shouldCreateReminder(dueDate, offset)) {
          remindersToCreate.push({
            vehicleId: policy.vehicle.id,
            sourceType: 'InsurancePolicy',
            sourceId: policy.id,
            title: `保险即将到期 - ${policy.vehicle.plateNo}`,
            description: `${policy.insuranceType || '保险'} 将于 ${dueDate.toLocaleDateString('zh-CN')} 到期（${offset}天提醒）`,
            dueDate: dueDate,
            remindAt: getRemindDate(dueDate, offset),
            offsetDays: offset,
            channel: 'inbox',
            payload: JSON.stringify({
              vehicleId: policy.vehicle.id,
              plateNo: policy.vehicle.plateNo,
              insuranceType: policy.insuranceType,
              insuranceCompany: policy.insuranceCompany,
              policyNo: policy.policyNo,
            }),
          });
        }
      }

      // Check for overdue (already expired)
      if (daysToDue < 0 && shouldCreateReminder(dueDate, 0)) {
        remindersToCreate.push({
          vehicleId: policy.vehicle.id,
          sourceType: 'InsurancePolicy',
          sourceId: policy.id,
          title: `保险已过期 - ${policy.vehicle.plateNo}`,
          description: `${policy.insuranceType || '保险'} 已于 ${dueDate.toLocaleDateString('zh-CN')} 过期`,
          dueDate: dueDate,
          remindAt: now,
          offsetDays: 0,
          channel: 'inbox',
          payload: JSON.stringify({
            vehicleId: policy.vehicle.id,
            plateNo: policy.vehicle.plateNo,
            insuranceType: policy.insuranceType,
            insuranceCompany: policy.insuranceCompany,
            policyNo: policy.policyNo,
            overdue: true,
          }),
        });
      }
    }

    // 2. Scan Annual Inspections
    const vehicles = await prisma.vehicle.findMany({
      where: {
        annualInspectionDueAt: {
          not: null,
        },
      },
      select: {
        id: true,
        plateNo: true,
        brandModel: true,
        annualInspectionDueAt: true,
        owner: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    for (const vehicle of vehicles) {
      if (!vehicle.annualInspectionDueAt) continue;

      const dueDate = new Date(vehicle.annualInspectionDueAt);
      const daysToDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      const offsets = [30, 15, 7];
      
      for (const offset of offsets) {
        if (shouldCreateReminder(dueDate, offset)) {
          remindersToCreate.push({
            vehicleId: vehicle.id,
            sourceType: 'AnnualInspection',
            sourceId: vehicle.id,
            title: `年检即将到期 - ${vehicle.plateNo}`,
            description: `年检将于 ${dueDate.toLocaleDateString('zh-CN')} 到期（${offset}天提醒）`,
            dueDate: dueDate,
            remindAt: getRemindDate(dueDate, offset),
            offsetDays: offset,
            channel: 'inbox',
            payload: JSON.stringify({
              vehicleId: vehicle.id,
              plateNo: vehicle.plateNo,
              brandModel: vehicle.brandModel,
            }),
          });
        }
      }

      if (daysToDue < 0 && shouldCreateReminder(dueDate, 0)) {
        remindersToCreate.push({
          vehicleId: vehicle.id,
          sourceType: 'AnnualInspection',
          sourceId: vehicle.id,
          title: `年检已过期 - ${vehicle.plateNo}`,
          description: `年检已于 ${dueDate.toLocaleDateString('zh-CN')} 过期`,
          dueDate: dueDate,
          remindAt: now,
          offsetDays: 0,
          channel: 'inbox',
          payload: JSON.stringify({
            vehicleId: vehicle.id,
            plateNo: vehicle.plateNo,
            brandModel: vehicle.brandModel,
            overdue: true,
          }),
        });
      }
    }

    // 3. Scan Loan Installments (unpaid)
    const installments = await prisma.loanInstallment.findMany({
      where: {
        paidAt: null,
      },
      include: {
        loan: {
          include: {
            vehicle: {
              select: {
                id: true,
                plateNo: true,
                brandModel: true,
                owner: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    for (const installment of installments) {
      const dueDate = new Date(installment.dueDate);
      const daysToDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      const offsets = [30, 15, 7];
      
      for (const offset of offsets) {
        if (shouldCreateReminder(dueDate, offset)) {
          remindersToCreate.push({
            vehicleId: installment.loan.vehicle.id,
            sourceType: 'LoanInstallment',
            sourceId: installment.id,
            title: `贷款还款提醒 - ${installment.loan.vehicle.plateNo}`,
            description: `第 ${installment.periodNumber} 期还款将于 ${dueDate.toLocaleDateString('zh-CN')} 到期（${offset}天提醒）`,
            dueDate: dueDate,
            remindAt: getRemindDate(dueDate, offset),
            offsetDays: offset,
            channel: 'inbox',
            payload: JSON.stringify({
              vehicleId: installment.loan.vehicle.id,
              plateNo: installment.loan.vehicle.plateNo,
              lender: installment.loan.lender,
              periodNumber: installment.periodNumber,
              monthlyPayment: installment.loan.monthlyPayment?.toString(),
            }),
          });
        }
      }

      if (daysToDue < 0 && shouldCreateReminder(dueDate, 0)) {
        remindersToCreate.push({
          vehicleId: installment.loan.vehicle.id,
          sourceType: 'LoanInstallment',
          sourceId: installment.id,
          title: `贷款已逾期 - ${installment.loan.vehicle.plateNo}`,
          description: `第 ${installment.periodNumber} 期还款已于 ${dueDate.toLocaleDateString('zh-CN')} 逾期`,
          dueDate: dueDate,
          remindAt: now,
          offsetDays: 0,
          channel: 'inbox',
          payload: JSON.stringify({
            vehicleId: installment.loan.vehicle.id,
            plateNo: installment.loan.vehicle.plateNo,
            lender: installment.loan.lender,
            periodNumber: installment.periodNumber,
            monthlyPayment: installment.loan.monthlyPayment?.toString(),
            overdue: true,
          }),
        });
      }
    }

    // Create or update reminders (upsert to handle duplicates)
    let created = 0;
    let skipped = 0;

    for (const reminder of remindersToCreate) {
      try {
        await prisma.reminder.upsert({
          where: {
            vehicleId_sourceType_sourceId_offsetDays_channel: {
              vehicleId: reminder.vehicleId,
              sourceType: reminder.sourceType,
              sourceId: reminder.sourceId || '',
              offsetDays: reminder.offsetDays,
              channel: reminder.channel,
            },
          },
          update: {
            // Update title and description in case details changed
            title: reminder.title,
            description: reminder.description,
            dueDate: reminder.dueDate,
            remindAt: reminder.remindAt,
            payload: reminder.payload,
          },
          create: reminder,
        });
        created++;
      } catch (error) {
        console.error('Failed to create reminder:', error);
        skipped++;
      }
    }

    // Send webhooks if configured
    const webhookUrl = process.env.NOTIFY_WEBHOOK_URL;
    if (webhookUrl && created > 0) {
      try {
        const message = `**车辆提醒汇总**\n\n今日共生成 ${created} 条提醒，请及时处理。\n\n查看详情：${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/reminders`;
        
        await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            msgtype: 'text',
            text: {
              content: message,
            },
          }),
        });

        // Update status to SENT
        await prisma.reminder.updateMany({
          where: {
            status: 'PENDING',
            createdAt: {
              gte: new Date(Date.now() - 60000), // Last minute
            },
          },
          data: {
            status: 'SENT',
            sentAt: new Date(),
          },
        });
      } catch (webhookError) {
        console.error('Webhook failed:', webhookError);
        // Don't fail the job if webhook fails
      }
    }

    // Update all vehicles availability based on current conditions
    const availabilityResult = await updateAllVehiclesAvailability();

    return NextResponse.json({
      success: true,
      created,
      skipped,
      total: remindersToCreate.length,
      availabilityUpdated: availabilityResult.updated,
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
