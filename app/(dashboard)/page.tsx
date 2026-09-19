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

  // Get KPI counts based on user role
  let totalVehicles = 0;
  let availableVehicles = 0;
  let riskVehicles = 0;
  let inUseVehicles = 0;
  let upcomingExpirations: any[] = [];

  if (session.user.role === 'ADMIN') {
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

    // Get vehicles with annual inspection due in next 60 days
    const sixtyDaysFromNow = new Date();
    sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);
    
    upcomingExpirations = await prisma.vehicle.findMany({
      where: {
        annualInspectionDueAt: {
          lte: sixtyDaysFromNow,
          gte: new Date(),
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
      take: 5,
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

    const sixtyDaysFromNow = new Date();
    sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);
    
    upcomingExpirations = await prisma.vehicle.findMany({
      where: {
        ...userFilter,
        annualInspectionDueAt: {
          lte: sixtyDaysFromNow,
          gte: new Date(),
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
      take: 5,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">工作台</h1>
        <p className="mt-2 text-sm text-gray-600">车辆管理系统数据概览</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
      </div>

      {/* Upcoming Expirations */}
      <div className="card">
        <div className="px-6 py-5 border-b border-gray-200">
          <h3 className="text-lg font-medium leading-6 text-gray-900">即将到期的年检</h3>
          <p className="mt-1 text-sm text-gray-500">未来60天内需要年检的车辆</p>
        </div>
        <div className="px-6 py-4">
          {upcomingExpirations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="mt-2">暂无即将到期的年检</p>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingExpirations.map((vehicle) => {
                const daysUntilDue = Math.floor(
                  (new Date(vehicle.annualInspectionDueAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                );
                const isUrgent = daysUntilDue <= 15;

                return (
                  <Link
                    key={vehicle.id}
                    href={`/vehicles/${vehicle.id}`}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                        isUrgent ? 'bg-red-100' : 'bg-yellow-100'
                      }`}>
                        <svg className={`w-6 h-6 ${isUrgent ? 'text-red-600' : 'text-yellow-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{vehicle.plateNo}</p>
                        <p className="text-xs text-gray-500">{vehicle.brandModel} · {vehicle.owner.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(vehicle.annualInspectionDueAt).toLocaleDateString('zh-CN')}
                        </p>
                        <p className={`text-xs ${isUrgent ? 'text-red-600' : 'text-yellow-600'} font-medium`}>
                          {daysUntilDue}天后到期
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
          )}
        </div>
        {upcomingExpirations.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
            <Link
              href="/vehicles"
              className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center"
            >
              查看所有车辆
              <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
