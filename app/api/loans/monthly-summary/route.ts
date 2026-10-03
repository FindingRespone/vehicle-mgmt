import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isSuperAdmin } from '@/lib/roles';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    if (!isSuperAdmin(session.user.role)) {
      return NextResponse.json({ error: '只有超级管理员可以查看贷款信息' }, { status: 403 });
    }

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get all unpaid installments (for overdue calculation)
    const allUnpaidInstallments = await prisma.loanInstallment.findMany({
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
              },
            },
          },
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
    });

    // Get current month installments (for monthly total)
    const monthInstallments = await prisma.loanInstallment.findMany({
      where: {
        dueDate: {
          gte: firstDayOfMonth,
          lte: lastDayOfMonth,
        },
      },
      include: {
        loan: true,
      },
    });

    const monthTotal = monthInstallments.reduce((sum, inst) => {
      return sum + Number(inst.loan.monthlyPayment);
    }, 0);

    const vehicleCount = new Set(allUnpaidInstallments.map(inst => inst.loan.vehicleId)).size;

    return NextResponse.json({
      installments: allUnpaidInstallments,
      monthTotal,
      installmentCount: allUnpaidInstallments.length,
      vehicleCount,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    });
  } catch (error) {
    console.error('Get monthly loan summary error:', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}
