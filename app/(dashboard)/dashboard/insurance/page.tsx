import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export default async function InsurancePage() {
  const session = await auth();
  
  if (!session) {
    return null;
  }

  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  let expiredPolicies: any[] = [];
  let soonExpiringPolicies: any[] = [];
  let expiredPoliciesCount = 0;
  let expiringPoliciesCount = 0;

  if (session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN') {
    // Admin sees all vehicles
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
      take: 50,
    });

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
      take: 50,
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
      take: 50,
    });

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
      take: 50,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">保险事项</h1>
          <p className="mt-2 text-sm text-gray-600">已过期和即将到期的保单</p>
        </div>
        <Link
          href="/dashboard"
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          返回工作台
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="card p-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-red-600">{expiredPoliciesCount}</div>
            <div className="text-sm text-gray-600 mt-2">已过期保单</div>
          </div>
        </div>
        <div className="card p-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-orange-600">{expiringPoliciesCount}</div>
            <div className="text-sm text-gray-600 mt-2">即将到期保单</div>
          </div>
        </div>
      </div>

      {/* Insurance Policies */}
      <div className="card">
        <div className="px-6 py-4">
          {expiredPolicies.length === 0 && soonExpiringPolicies.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
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
                  <h3 className="text-sm font-semibold text-red-600 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    已过期保单 ({expiredPolicies.length})
                  </h3>
                  <div className="space-y-3">
                    {expiredPolicies.map((policy) => {
                      const daysOverdue = Math.floor(
                        (now.getTime() - new Date(policy.endDate).getTime()) / (1000 * 60 * 60 * 24)
                      );

                      return (
                        <Link
                          key={policy.id}
                          href={`/vehicles/${policy.vehicle.id}`}
                          className="flex items-center justify-between p-4 bg-red-50 rounded-lg hover:bg-red-100 transition-colors border border-red-200"
                        >
                          <div className="flex items-center space-x-4 flex-1 min-w-0">
                            <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-red-100">
                              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">{policy.vehicle.plateNo}</p>
                              <p className="text-xs text-gray-600 mt-0.5">{policy.insuranceType} · {policy.insuranceCompany}</p>
                              <p className="text-xs text-gray-500">保单号: {policy.policyNo}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3 flex-shrink-0">
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

              {/* Expiring Policies */}
              {soonExpiringPolicies.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-orange-600 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    即将到期 ({soonExpiringPolicies.length})
                  </h3>
                  <div className="space-y-3">
                    {soonExpiringPolicies.map((policy) => {
                      const daysLeft = Math.floor(
                        (new Date(policy.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                      );
                      const isUrgent = daysLeft <= 7;

                      return (
                        <Link
                          key={policy.id}
                          href={`/vehicles/${policy.vehicle.id}`}
                          className={`flex items-center justify-between p-4 rounded-lg transition-colors border ${
                            isUrgent
                              ? 'bg-orange-50 border-orange-200 hover:bg-orange-100'
                              : 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'
                          }`}
                        >
                          <div className="flex items-center space-x-4 flex-1 min-w-0">
                            <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                              isUrgent ? 'bg-orange-100' : 'bg-yellow-100'
                            }`}>
                              <svg className={`w-6 h-6 ${isUrgent ? 'text-orange-600' : 'text-yellow-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">{policy.vehicle.plateNo}</p>
                              <p className="text-xs text-gray-600 mt-0.5">{policy.insuranceType} · {policy.insuranceCompany}</p>
                              <p className="text-xs text-gray-500">保单号: {policy.policyNo}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3 flex-shrink-0">
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
    </div>
  );
}
