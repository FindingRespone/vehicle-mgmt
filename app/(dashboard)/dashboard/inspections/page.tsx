import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export default async function InspectionsPage() {
  const session = await auth();
  
  if (!session) {
    return null;
  }

  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  let expiredInspections: any[] = [];
  let soonDueInspections: any[] = [];

  if (session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN') {
    // Admin sees all vehicles
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
      take: 50,
    });

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
      take: 50,
    });

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
      take: 50,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">年检事项</h1>
          <p className="mt-2 text-sm text-gray-600">已过期和即将到期的年检</p>
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
          <div className="text-sm text-gray-600 mb-1">已过期年检</div>
          <div className="text-3xl font-semibold text-red-600">{expiredInspections.length}</div>
        </div>
        <div className="bg-white border border-gray-200 p-5">
          <div className="text-sm text-gray-600 mb-1">即将到期年检</div>
          <div className="text-3xl font-semibold text-orange-500">{soonDueInspections.length}</div>
        </div>
      </div>

      {/* Annual Inspections */}
      <div className="bg-white border border-gray-200">
        <div className="px-5 py-4">
          {expiredInspections.length === 0 && soonDueInspections.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-sm">所有年检状态正常</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Expired Inspections */}
              {expiredInspections.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    已过期年检 ({expiredInspections.length})
                  </h3>
                  <div className="space-y-2">
                    {expiredInspections.map((vehicle) => {
                      const daysOverdue = Math.floor(
                        (now.getTime() - new Date(vehicle.annualInspectionDueAt).getTime()) / (1000 * 60 * 60 * 24)
                      );

                      return (
                        <Link
                          key={vehicle.id}
                          href={`/vehicles/${vehicle.id}`}
                          className="flex items-center justify-between p-3 border border-red-200 bg-red-50 hover:bg-red-100 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-3">
                              <span className="text-sm font-medium text-gray-900">{vehicle.plateNo}</span>
                              <span className="text-xs text-gray-600">{vehicle.brandModel}</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">负责人: {vehicle.owner.name}</div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-4">
                            <div className="text-sm text-gray-900">
                              {new Date(vehicle.annualInspectionDueAt).toLocaleDateString('zh-CN')}
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

              {/* Expiring Inspections */}
              {soonDueInspections.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    即将到期 ({soonDueInspections.length})
                  </h3>
                  <div className="space-y-2">
                    {soonDueInspections.map((vehicle) => {
                      const daysLeft = Math.floor(
                        (new Date(vehicle.annualInspectionDueAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                      );
                      const isUrgent = daysLeft <= 7;

                      return (
                        <Link
                          key={vehicle.id}
                          href={`/vehicles/${vehicle.id}`}
                          className={`flex items-center justify-between p-3 border transition-colors ${
                            isUrgent
                              ? 'border-orange-200 bg-orange-50 hover:bg-orange-100'
                              : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-3">
                              <span className="text-sm font-medium text-gray-900">{vehicle.plateNo}</span>
                              <span className="text-xs text-gray-600">{vehicle.brandModel}</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">负责人: {vehicle.owner.name}</div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-4">
                            <div className="text-sm text-gray-900">
                              {new Date(vehicle.annualInspectionDueAt).toLocaleDateString('zh-CN')}
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
