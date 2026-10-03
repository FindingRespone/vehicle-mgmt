import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export default async function DashboardPage() {
  const session = await auth();
  
  if (!session) {
    return null;
  }

  const now = new Date();

  // Get KPI counts based on user role
  let totalVehicles = 0;
  let availableVehicles = 0;
  let riskVehicles = 0;
  let inUseVehicles = 0;
  let expiringPoliciesCount = 0;
  let expiredPoliciesCount = 0;
  let expiredInspections: any[] = [];
  let soonDueInspections: any[] = [];
  let monthlyLoanSummary: any = null;

  if (session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN') {
    // Admin sees all vehicles
    totalVehicles = await prisma.vehicle.count();
    availableVehicles = await prisma.vehicle.count({
      where: { availability: 'AVAILABLE' },
    });
    riskVehicles = await prisma.vehicle.count({
      where: { availability: 'RISK' },
    });
    inUseVehicles = await prisma.vehicle.count({
      where: { status: 'IN_USE' },
    });

    // Fetch monthly loan summary for SUPER_ADMIN only
    if (session.user.role === 'SUPER_ADMIN') {
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      // Get all unpaid installments for overdue calculation
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

      // Get current month installments for monthly total
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

      monthlyLoanSummary = {
        installments: allUnpaidInstallments,
        monthTotal,
        year: now.getFullYear(),
        month: now.getMonth() + 1,
      };
    }

    // Get count of insurance policies expiring within 30 days and expired
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    expiredPoliciesCount = await prisma.insurancePolicy.count({
      where: {
        endDate: {
          lt: now,
        },
      },
    });

    expiringPoliciesCount = await prisma.insurancePolicy.count({
      where: {
        endDate: {
          lte: thirtyDaysFromNow,
          gte: now,
        },
      },
    });

    // Get vehicles with expired annual inspection
    expiredInspections = await prisma.vehicle.findMany({
      where: {
        annualInspectionDueAt: {
          lt: now,
          not: null,
        },
      },
      include: {
        owner: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        annualInspectionDueAt: 'desc',
      },
      take: 10,
    });

    // Get vehicles with annual inspection due within 30 days
    soonDueInspections = await prisma.vehicle.findMany({
      where: {
        annualInspectionDueAt: {
          lte: thirtyDaysFromNow,
          gte: now,
        },
      },
      include: {
        owner: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        annualInspectionDueAt: 'asc',
      },
      take: 10,
    });
  } else {
    // Regular users see only their vehicles
    const userFilter = {
      OR: [
        { ownerUserId: session.user.id },
        {
          members: {
            some: {
              userId: session.user.id,
            },
          },
        },
      ],
    };

    totalVehicles = await prisma.vehicle.count({
      where: userFilter,
    });
    availableVehicles = await prisma.vehicle.count({
      where: {
        ...userFilter,
        availability: 'AVAILABLE',
      },
    });
    riskVehicles = await prisma.vehicle.count({
      where: {
        ...userFilter,
        availability: 'RISK',
      },
    });
    inUseVehicles = await prisma.vehicle.count({
      where: {
        ...userFilter,
        status: 'IN_USE',
      },
    });

    // Get count of insurance policies expiring within 30 days and expired for user's vehicles
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    expiredPoliciesCount = await prisma.insurancePolicy.count({
      where: {
        vehicle: userFilter,
        endDate: {
          lt: now,
        },
      },
    });

    expiringPoliciesCount = await prisma.insurancePolicy.count({
      where: {
        vehicle: userFilter,
        endDate: {
          lte: thirtyDaysFromNow,
          gte: now,
        },
      },
    });

    // Get vehicles with expired annual inspection
    expiredInspections = await prisma.vehicle.findMany({
      where: {
        ...userFilter,
        annualInspectionDueAt: {
          lt: now,
          not: null,
        },
      },
      include: {
        owner: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        annualInspectionDueAt: 'desc',
      },
      take: 10,
    });

    // Get vehicles with annual inspection due within 30 days
    soonDueInspections = await prisma.vehicle.findMany({
      where: {
        ...userFilter,
        annualInspectionDueAt: {
          lte: thirtyDaysFromNow,
          gte: now,
        },
      },
      include: {
        owner: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        annualInspectionDueAt: 'asc',
      },
      take: 10,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">工作台</h1>
        <p className="mt-2 text-sm text-gray-600">车辆管理系统数据概览</p>
      </div>

      {/* Vehicle KPI Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">总车辆数</dt>
                <dd className="text-2xl font-semibold text-gray-900">{totalVehicles}</dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-green-500 text-white">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">可用车辆</dt>
                <dd className="text-2xl font-semibold text-gray-900">{availableVehicles}</dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-yellow-500 text-white">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">使用中</dt>
                <dd className="text-2xl font-semibold text-gray-900">{inUseVehicles}</dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-red-500 text-white">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">风险车辆</dt>
                <dd className="text-2xl font-semibold text-gray-900">{riskVehicles}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className={`grid gap-4 ${session.user.role === 'SUPER_ADMIN' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
        {/* Insurance Link */}
        <Link
          href="/dashboard/insurance"
          className="block bg-white border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-medium text-gray-900">保险事项</h3>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-gray-600">已过期</span>
              <span className="text-xl font-semibold text-red-600">{expiredPoliciesCount}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-gray-600">即将到期</span>
              <span className="text-xl font-semibold text-orange-500">{expiringPoliciesCount}</span>
            </div>
          </div>
        </Link>

        {/* Inspections Link */}
        <Link
          href="/dashboard/inspections"
          className="block bg-white border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-medium text-gray-900">年检事项</h3>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-gray-600">已过期</span>
              <span className="text-xl font-semibold text-red-600">{expiredInspections.length}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-gray-600">即将到期</span>
              <span className="text-xl font-semibold text-orange-500">{soonDueInspections.length}</span>
            </div>
          </div>
        </Link>

        {/* Loans Link - SUPER_ADMIN only */}
        {session.user.role === 'SUPER_ADMIN' && monthlyLoanSummary && (
          <Link
            href="/dashboard/loans"
            className="block bg-white border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-medium text-gray-900">贷款还款</h3>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-gray-600">逾期未还</span>
                <span className="text-xl font-semibold text-red-600">
                  {monthlyLoanSummary.installments.filter((inst: any) => {
                    const dueDate = new Date(inst.dueDate);
                    return dueDate < now && !inst.paidAt;
                  }).length}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-gray-600">本月待还</span>
                <span className="text-xl font-semibold text-gray-700">
                  {monthlyLoanSummary.installments.filter((inst: any) => {
                    const dueDate = new Date(inst.dueDate);
                    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                    return dueDate >= firstDayOfMonth && dueDate <= lastDayOfMonth && dueDate >= now && !inst.paidAt;
                  }).length}
                </span>
              </div>
              <div className="pt-2.5 border-t border-gray-100">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-gray-600">本月合计</span>
                  <span className="text-xl font-semibold text-gray-900">
                    ¥{monthlyLoanSummary.monthTotal.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
