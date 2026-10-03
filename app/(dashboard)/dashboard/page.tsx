import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

const statusLabels = {
  IN_USE: '使用中',
  MAINTENANCE: '维护中',
  STOPPED: '停用',
  DISPOSING: '处置中',
};

const availabilityLabels = {
  AVAILABLE: '可用',
  RISK: '风险',
  UNAVAILABLE: '不可用',
};

export default async function DashboardPage() {
  const session = await auth();
  
  if (!session) {
    return null;
  }

  // Get current date for comparisons
  const now = new Date();

  // Get KPI counts based on user role
  let totalVehicles = 0;
  let availableVehicles = 0;
  let riskVehicles = 0;
  let inUseVehicles = 0;
  let expiringPoliciesCount = 0;
  let expiredPoliciesCount = 0;
  let expiredPolicies: any[] = [];
  let soonExpiringPolicies: any[] = [];
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

      const installments = await prisma.loanInstallment.findMany({
        where: {
          dueDate: {
            gte: firstDayOfMonth,
            lte: lastDayOfMonth,
          },
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

      const monthTotal = installments.reduce((sum, inst) => {
        return sum + Number(inst.loan.monthlyPayment);
      }, 0);

      const vehicleCount = new Set(installments.map(inst => inst.loan.vehicleId)).size;

      monthlyLoanSummary = {
        installments,
        monthTotal,
        installmentCount: installments.length,
        vehicleCount,
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

    // Get expired policies
    expiredPolicies = await prisma.insurancePolicy.findMany({
      where: {
        endDate: {
          lt: now,
        },
      },
      include: {
        vehicle: {
          select: {
            id: true,
            plateNo: true,
            brandModel: true,
          },
        },
      },
      orderBy: {
        endDate: 'desc',
      },
      take: 10,
    });

    // Get soon-expiring policies
    soonExpiringPolicies = await prisma.insurancePolicy.findMany({
      where: {
        endDate: {
          lte: thirtyDaysFromNow,
          gte: now,
        },
      },
      include: {
        vehicle: {
          select: {
            id: true,
            plateNo: true,
            brandModel: true,
          },
        },
      },
      orderBy: {
        endDate: 'asc',
      },
      take: 10,
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
    const now = new Date();
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

    // Get expired policies
    expiredPolicies = await prisma.insurancePolicy.findMany({
      where: {
        vehicle: userFilter,
        endDate: {
          lt: now,
        },
      },
      include: {
        vehicle: {
          select: {
            id: true,
            plateNo: true,
            brandModel: true,
          },
        },
      },
      orderBy: {
        endDate: 'desc',
      },
      take: 10,
    });

    // Get soon-expiring policies
    soonExpiringPolicies = await prisma.insurancePolicy.findMany({
      where: {
        vehicle: userFilter,
        endDate: {
          lte: thirtyDaysFromNow,
          gte: now,
        },
      },
      include: {
        vehicle: {
          select: {
            id: true,
            plateNo: true,
            brandModel: true,
          },
        },
      },
      orderBy: {
        endDate: 'asc',
      },
      take: 10,
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        <div className="card p-6 hover:shadow-md transition-shadow">
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
                <dd className="flex items-baseline">
                  <div className="text-2xl font-semibold text-gray-900">{totalVehicles}</div>
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card p-6 hover:shadow-md transition-shadow">
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
                <dd className="flex items-baseline">
                  <div className="text-2xl font-semibold text-gray-900">{availableVehicles}</div>
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card p-6 hover:shadow-md transition-shadow">
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
                <dd className="flex items-baseline">
                  <div className="text-2xl font-semibold text-gray-900">{inUseVehicles}</div>
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card p-6 hover:shadow-md transition-shadow">
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
                <dd className="flex items-baseline">
                  <div className="text-2xl font-semibold text-gray-900">{riskVehicles}</div>
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-purple-500 text-white">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">保险事项</dt>
                <dd className="flex items-baseline space-x-2">
                  <div className="text-2xl font-semibold text-red-600">{expiredPoliciesCount}</div>
                  <span className="text-xs text-gray-500">已过期</span>
                  <span className="text-gray-300">|</span>
                  <div className="text-2xl font-semibold text-yellow-600">{expiringPoliciesCount}</div>
                  <span className="text-xs text-gray-500">即将到期</span>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* Insurance Policies */}
      <div className="card">
        <div className="px-6 py-5 border-b border-gray-200">
          <h3 className="text-lg font-medium leading-6 text-gray-900">保险事项</h3>
          <p className="mt-1 text-sm text-gray-500">已过期和即将到期的保单</p>
        </div>
        <div className="px-6 py-4">
          {expiredPolicies.length === 0 && soonExpiringPolicies.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <p className="mt-2">所有保单状态正常</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Expired Policies */}
              {expiredPolicies.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-red-600 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    已过期保单 ({expiredPolicies.length})
                  </h4>
                  <div className="space-y-3">
                    {expiredPolicies.map((policy) => {
                      const daysOverdue = Math.floor(
                        (new Date().getTime() - new Date(policy.endDate).getTime()) / (1000 * 60 * 60 * 24)
                      );

                      return (
                        <Link
                          key={policy.id}
                          href={`/vehicles/${policy.vehicle.id}`}
                          className="flex items-center justify-between p-4 bg-red-50 rounded-lg hover:bg-red-100 transition-colors border border-red-200"
                        >
                          <div className="flex items-center space-x-4">
                            <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-red-100">
                              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{policy.vehicle.plateNo}</p>
                              <p className="text-xs text-gray-600">{policy.insuranceType} · {policy.insuranceCompany}</p>
                              <p className="text-xs text-gray-500">保单号: {policy.policyNo}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="text-right">
                              <p className="text-sm font-medium text-gray-900">
                                {new Date(policy.endDate).toLocaleDateString('zh-CN')}
                              </p>
                              <p className="text-xs text-red-600 font-medium">
                                已逾期 {daysOverdue} 天
                              </p>
                            </div>
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Soon Expiring Policies */}
              {soonExpiringPolicies.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-yellow-600 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    即将到期 ({soonExpiringPolicies.length})
                  </h4>
                  <div className="space-y-3">
                    {soonExpiringPolicies.map((policy) => {
                      const daysLeft = Math.floor(
                        (new Date(policy.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                      );
                      const isUrgent = daysLeft <= 7;

                      return (
                        <Link
                          key={policy.id}
                          href={`/vehicles/${policy.vehicle.id}`}
                          className={`flex items-center justify-between p-4 rounded-lg hover:bg-yellow-100 transition-colors border ${
                            isUrgent ? 'bg-orange-50 border-orange-200' : 'bg-yellow-50 border-yellow-200'
                          }`}
                        >
                          <div className="flex items-center space-x-4">
                            <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                              isUrgent ? 'bg-orange-100' : 'bg-yellow-100'
                            }`}>
                              <svg className={`w-6 h-6 ${isUrgent ? 'text-orange-600' : 'text-yellow-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{policy.vehicle.plateNo}</p>
                              <p className="text-xs text-gray-600">{policy.insuranceType} · {policy.insuranceCompany}</p>
                              <p className="text-xs text-gray-500">保单号: {policy.policyNo}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="text-right">
                              <p className="text-sm font-medium text-gray-900">
                                {new Date(policy.endDate).toLocaleDateString('zh-CN')}
                              </p>
                              <p className={`text-xs font-medium ${isUrgent ? 'text-orange-600' : 'text-yellow-600'}`}>
                                {daysLeft} 天后到期
                              </p>
                            </div>
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Annual Inspections */}
      <div className="card">
        <div className="px-6 py-5 border-b border-gray-200">
          <h3 className="text-lg font-medium leading-6 text-gray-900">年检事项</h3>
          <p className="mt-1 text-sm text-gray-500">已过期和即将到期的年检</p>
        </div>
        <div className="px-6 py-4">
          {expiredInspections.length === 0 && soonDueInspections.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="mt-2">所有年检状态正常</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Expired Inspections */}
              {expiredInspections.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-red-600 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    已过期年检 ({expiredInspections.length})
                  </h4>
                  <div className="space-y-3">
                    {expiredInspections.map((vehicle) => {
                      const daysOverdue = Math.floor(
                        (new Date().getTime() - new Date(vehicle.annualInspectionDueAt).getTime()) / (1000 * 60 * 60 * 24)
                      );

                      return (
                        <Link
                          key={vehicle.id}
                          href={`/vehicles/${vehicle.id}`}
                          className="flex items-center justify-between p-4 bg-red-50 rounded-lg hover:bg-red-100 transition-colors border border-red-200"
                        >
                          <div className="flex items-center space-x-4">
                            <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-red-100">
                              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{vehicle.plateNo}</p>
                              <p className="text-xs text-gray-600">{vehicle.brandModel}</p>
                              <p className="text-xs text-gray-500">负责人: {vehicle.owner.name}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="text-right">
                              <p className="text-sm font-medium text-gray-900">
                                {new Date(vehicle.annualInspectionDueAt).toLocaleDateString('zh-CN')}
                              </p>
                              <p className="text-xs text-red-600 font-medium">
                                已逾期 {daysOverdue} 天
                              </p>
                            </div>
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Soon Due Inspections */}
              {soonDueInspections.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-yellow-600 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    即将到期 ({soonDueInspections.length})
                  </h4>
                  <div className="space-y-3">
                    {soonDueInspections.map((vehicle) => {
                      const daysLeft = Math.floor(
                        (new Date(vehicle.annualInspectionDueAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                      );
                      const isUrgent = daysLeft <= 7;

                      return (
                        <Link
                          key={vehicle.id}
                          href={`/vehicles/${vehicle.id}`}
                          className={`flex items-center justify-between p-4 rounded-lg hover:bg-yellow-100 transition-colors border ${
                            isUrgent ? 'bg-orange-50 border-orange-200' : 'bg-yellow-50 border-yellow-200'
                          }`}
                        >
                          <div className="flex items-center space-x-4">
                            <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                              isUrgent ? 'bg-orange-100' : 'bg-yellow-100'
                            }`}>
                              <svg className={`w-6 h-6 ${isUrgent ? 'text-orange-600' : 'text-yellow-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{vehicle.plateNo}</p>
                              <p className="text-xs text-gray-600">{vehicle.brandModel}</p>
                              <p className="text-xs text-gray-500">负责人: {vehicle.owner.name}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="text-right">
                              <p className="text-sm font-medium text-gray-900">
                                {new Date(vehicle.annualInspectionDueAt).toLocaleDateString('zh-CN')}
                              </p>
                              <p className={`text-xs font-medium ${isUrgent ? 'text-orange-600' : 'text-yellow-600'}`}>
                                {daysLeft} 天后到期
                              </p>
                            </div>
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Loan Repayments - SUPER_ADMIN only */}
      {session.user.role === 'SUPER_ADMIN' && monthlyLoanSummary && (
        <div className="card">
          <div className="px-6 py-5 border-b border-gray-200">
            <h3 className="text-lg font-medium leading-6 text-gray-900">贷款还款事项</h3>
            <p className="mt-1 text-sm text-gray-500">
              {monthlyLoanSummary.year}年{monthlyLoanSummary.month}月应还贷款
            </p>
          </div>
          <div className="px-6 py-4">
            {monthlyLoanSummary.installments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="mt-2">本月无需还款</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary Info */}
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center bg-blue-100">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        本月应还 {monthlyLoanSummary.installmentCount} 笔，共计 {monthlyLoanSummary.vehicleCount} 辆车
                      </p>
                      <p className="text-xs text-gray-600">
                        总金额: ¥{monthlyLoanSummary.monthTotal.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Installment List */}
                <div className="space-y-3">
                  {monthlyLoanSummary.installments.map((installment: any) => {
                    const dueDate = new Date(installment.dueDate);
                    const today = new Date();
                    const isOverdue = dueDate < today && !installment.paidAt;
                    const isPaid = !!installment.paidAt;
                    const dueDay = dueDate.getDate();

                    return (
                      <Link
                        key={installment.id}
                        href={`/vehicles/${installment.loan.vehicle.id}`}
                        className={`flex items-center justify-between p-4 rounded-lg transition-colors border ${
                          isPaid
                            ? 'bg-green-50 border-green-200 hover:bg-green-100'
                            : isOverdue
                            ? 'bg-red-50 border-red-200 hover:bg-red-100'
                            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center space-x-4">
                          <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                            isPaid
                              ? 'bg-green-100'
                              : isOverdue
                              ? 'bg-red-100'
                              : 'bg-gray-100'
                          }`}>
                            {isPaid ? (
                              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            ) : isOverdue ? (
                              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                            ) : (
                              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {installment.loan.vehicle.plateNo}
                              {isPaid && <span className="ml-2 text-xs text-green-600 font-medium">已还款</span>}
                              {isOverdue && <span className="ml-2 text-xs text-red-600 font-medium">已逾期</span>}
                            </p>
                            <p className="text-xs text-gray-600">
                              第 {installment.periodNumber} 期 · {installment.loan.lender}
                            </p>
                            <p className="text-xs text-gray-500">
                              应还金额: ¥{Number(installment.loan.monthlyPayment).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">
                              {monthlyLoanSummary.month}月{dueDay}日
                            </p>
                            <p className="text-xs text-gray-500">
                              {dueDate.toLocaleDateString('zh-CN')}
                            </p>
                          </div>
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
