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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="bg-white border border-gray-200 p-5">
          <div className="text-sm text-gray-600 mb-1">已过期保单</div>
          <div className="text-3xl font-semibold text-red-600">{expiredPoliciesCount}</div>
        </div>
        <div className="bg-white border border-gray-200 p-5">
          <div className="text-sm text-gray-600 mb-1">即将到期保单</div>
          <div className="text-3xl font-semibold text-orange-500">{expiringPoliciesCount}</div>
        </div>
      </div>

      {/* Insurance Policies */}
      <div className="bg-white border border-gray-200">
        <div className="px-5 py-4">
          {expiredPolicies.length === 0 && soonExpiringPolicies.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-sm">所有保单状态正常</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Expired Policies */}
              {expiredPolicies.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    已过期保单 ({expiredPolicies.length})
                  </h3>
                  <div className="space-y-2">
                    {expiredPolicies.map((policy) => {
                      const daysOverdue = Math.floor(
                        (now.getTime() - new Date(policy.endDate).getTime()) / (1000 * 60 * 60 * 24)
                      );

                      return (
                        <Link
                          key={policy.id}
                          href={`/vehicles/${policy.vehicle.id}`}
                          className="flex items-center justify-between p-3 border border-red-200 bg-red-50 hover:bg-red-100 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-3">
                              <span className="text-sm font-medium text-gray-900">{policy.vehicle.plateNo}</span>
                              <span className="text-xs text-gray-600">{policy.insuranceType}</span>
                              <span className="text-xs text-gray-500">{policy.insuranceCompany}</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">保单号: {policy.policyNo}</div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-4">
                            <div className="text-sm text-gray-900">
                              {new Date(policy.endDate).toLocaleDateString('zh-CN')}
                            </div>
                            <div className="text-xs text-red-600 font-medium mt-0.5">
                              已逾期 {daysOverdue} 天
                            </div>
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
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    即将到期 ({soonExpiringPolicies.length})
                  </h3>
                  <div className="space-y-2">
                    {soonExpiringPolicies.map((policy) => {
                      const daysLeft = Math.floor(
                        (new Date(policy.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                      );
                      const isUrgent = daysLeft <= 7;

                      return (
                        <Link
                          key={policy.id}
                          href={`/vehicles/${policy.vehicle.id}`}
                          className={`flex items-center justify-between p-3 border transition-colors ${
                            isUrgent
                              ? 'border-orange-200 bg-orange-50 hover:bg-orange-100'
                              : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-3">
                              <span className="text-sm font-medium text-gray-900">{policy.vehicle.plateNo}</span>
                              <span className="text-xs text-gray-600">{policy.insuranceType}</span>
                              <span className="text-xs text-gray-500">{policy.insuranceCompany}</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">保单号: {policy.policyNo}</div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-4">
                            <div className="text-sm text-gray-900">
                              {new Date(policy.endDate).toLocaleDateString('zh-CN')}
                            </div>
                            <div className={`text-xs font-medium mt-0.5 ${isUrgent ? 'text-orange-500' : 'text-gray-600'}`}>
                              {daysLeft} 天后到期
                            </div>
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
