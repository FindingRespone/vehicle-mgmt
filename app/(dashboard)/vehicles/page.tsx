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

export default async function VehiclesPage() {
  const session = await auth();

  if (!session) {
    return null;
  }

  let vehicles;

  if (session.user.role === 'ADMIN') {
    vehicles = await prisma.vehicle.findMany({
      include: {
        owner: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  } else {
    vehicles = await prisma.vehicle.findMany({
      where: {
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
      },
      include: {
        owner: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  return (
    <div>
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">车辆列表</h1>
          <p className="mt-2 text-sm text-gray-700">
            共 {vehicles.length} 辆车辆
          </p>
        </div>
        {session.user.role === 'ADMIN' && (
          <div className="mt-4 sm:mt-0">
            <Link
              href="/vehicles/new"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              + 新增车辆
            </Link>
          </div>
        )}
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {vehicles.length === 0 ? (
            <li className="px-4 py-8 text-center text-gray-500">
              暂无车辆数据
            </li>
          ) : (
            vehicles.map((vehicle) => (
              <li key={vehicle.id}>
                <Link
                  href={`/vehicles/${vehicle.id}`}
                  className="block hover:bg-gray-50 transition"
                >
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-lg font-medium text-blue-600 truncate">
                          {vehicle.plateNo}
                        </p>
                        <p className="mt-1 text-sm text-gray-600">
                          {vehicle.brandModel}
                        </p>
                      </div>
                      <div className="ml-4 flex-shrink-0 flex flex-col items-end space-y-1">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            vehicle.status === 'IN_USE'
                              ? 'bg-green-100 text-green-800'
                              : vehicle.status === 'MAINTENANCE'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {statusLabels[vehicle.status]}
                        </span>
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            vehicle.availability === 'AVAILABLE'
                              ? 'bg-blue-100 text-blue-800'
                              : vehicle.availability === 'RISK'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {availabilityLabels[vehicle.availability]}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="sm:flex">
                        <p className="flex items-center text-sm text-gray-500">
                          车主: {vehicle.owner.name}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                        {vehicle.annualInspectionDueAt && (
                          <p>
                            年检到期:{' '}
                            {new Date(
                              vehicle.annualInspectionDueAt
                            ).toLocaleDateString('zh-CN')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
