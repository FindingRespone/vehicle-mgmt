import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { VehicleStatus, VehicleAvailability } from '@prisma/client';

const statusLabels: Record<VehicleStatus, string> = {
  IN_USE: '使用中',
  MAINTENANCE: '维护中',
  STOPPED: '停用',
  DISPOSING: '处置中',
};

const availabilityLabels: Record<VehicleAvailability, string> = {
  AVAILABLE: '可用',
  RISK: '风险',
  UNAVAILABLE: '不可用',
};

const powerTypeLabels = {
  EV: '电车',
  FUEL: '油车',
};

const vehicleClassLabels = {
  TRUCK_4_2: '4.2米货车',
  OTHER: '其他车型',
};

type InsuranceStatus = 'EXPIRED' | 'EXPIRING' | 'NORMAL' | 'NONE';

interface SearchParams {
  page?: string;
  search?: string;
  status?: VehicleStatus;
  availability?: VehicleAvailability;
  insuranceStatus?: InsuranceStatus;
}

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  
  if (!session) {
    return null;
  }

  const page = parseInt(searchParams.page || '1', 10);
  const pageSize = 20;
  const skip = (page - 1) * pageSize;

  const search = searchParams.search || '';
  const statusFilter = searchParams.status;
  const availabilityFilter = searchParams.availability;
  const insuranceStatusFilter = searchParams.insuranceStatus;

  // Build where clause based on role and filters
  let where: any = {};

  // RBAC: Filter by user permissions
  if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
    where.OR = [
      { ownerUserId: session.user.id },
      {
        members: {
          some: {
            userId: session.user.id,
          },
        },
      },
    ];
  }

  // Apply filters
  if (search) {
    where.OR = [
      { plateNo: { contains: search, mode: 'insensitive' } },
      { brandModel: { contains: search, mode: 'insensitive' } },
      { owner: { name: { contains: search, mode: 'insensitive' } } },
    ];
    
    // If RBAC filter exists, combine with search
    if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
      where.AND = [
        {
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
        {
          OR: [
            { plateNo: { contains: search, mode: 'insensitive' } },
            { brandModel: { contains: search, mode: 'insensitive' } },
            { owner: { name: { contains: search, mode: 'insensitive' } } },
          ],
        },
      ];
      delete where.OR;
    }
  }

  if (statusFilter) {
    where.status = statusFilter;
  }

  if (availabilityFilter) {
    where.availability = availabilityFilter;
  }

  const [vehicles, totalCount] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      include: {
        owner: {
          select: {
            name: true,
          },
        },
        policies: {
          select: {
            endDate: true,
            insuranceType: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: pageSize,
    }),
    prisma.vehicle.count({ where }),
  ]);

  // Helper function to calculate insurance status
  const getInsuranceStatus = (policies: Array<{ endDate: Date; insuranceType: string }>): InsuranceStatus => {
    if (!policies || policies.length === 0) {
      return 'NONE';
    }

    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    // Check if any policy is expired
    const hasExpired = policies.some((p) => new Date(p.endDate) < now);
    if (hasExpired) {
      return 'EXPIRED';
    }

    // Check if any policy is expiring within 30 days
    const hasExpiring = policies.some((p) => {
      const endDate = new Date(p.endDate);
      return endDate >= now && endDate <= thirtyDaysFromNow;
    });
    if (hasExpiring) {
      return 'EXPIRING';
    }

    return 'NORMAL';
  };

  // Filter vehicles by insurance status if needed
  let filteredVehicles = vehicles;
  if (insuranceStatusFilter) {
    filteredVehicles = vehicles.filter((vehicle) => {
      return getInsuranceStatus(vehicle.policies) === insuranceStatusFilter;
    });
  }

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">车辆台账</h1>
          <p className="mt-2 text-sm text-gray-600 flex items-center">
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            共 <span className="font-semibold mx-1">{totalCount}</span> 辆车辆
          </p>
        </div>
        {(session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN') && (
          <Link
            href="/vehicles/new"
            className="btn btn-primary shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            新建车辆
          </Link>
        )}
      </div>

      {/* Search and Filters */}
      <div className="card p-4">
        <form method="get" className="grid grid-cols-1 gap-4 sm:grid-cols-5">
          <div className="sm:col-span-2">
            <input
              type="text"
              name="search"
              placeholder="搜索车牌号、品牌型号或负责人..."
              defaultValue={search}
              className="input-field"
            />
          </div>
          <div>
            <select name="status" defaultValue={statusFilter || ''} className="input-field">
              <option value="">全部状态</option>
              <option value="IN_USE">使用中</option>
              <option value="MAINTENANCE">维护中</option>
              <option value="STOPPED">停用</option>
              <option value="DISPOSING">处置中</option>
            </select>
          </div>
          <div>
            <select name="availability" defaultValue={availabilityFilter || ''} className="input-field">
              <option value="">全部可用性</option>
              <option value="AVAILABLE">可用</option>
              <option value="RISK">风险</option>
              <option value="UNAVAILABLE">不可用</option>
            </select>
          </div>
          <div>
            <select name="insuranceStatus" defaultValue={insuranceStatusFilter || ''} className="input-field">
              <option value="">全部保险状态</option>
              <option value="EXPIRED">已过期</option>
              <option value="EXPIRING">即将到期</option>
              <option value="NORMAL">正常</option>
              <option value="NONE">无保单</option>
            </select>
          </div>
          <div className="sm:col-span-5 flex gap-2">
            <button type="submit" className="btn btn-primary">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              搜索
            </button>
            <Link href="/vehicles" className="btn btn-secondary">
              重置
            </Link>
          </div>
        </form>
      </div>

      {/* Table */}
      {filteredVehicles.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {search || statusFilter || availabilityFilter || insuranceStatusFilter ? '未找到匹配的车辆' : '暂无车辆数据'}
          </h3>
          <p className="text-gray-500 mb-6">
            {search || statusFilter || availabilityFilter || insuranceStatusFilter
              ? '尝试调整搜索条件或清除筛选'
              : '还没有添加任何车辆信息'}
          </p>
          {(session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN') && !search && !statusFilter && !availabilityFilter && !insuranceStatusFilter && (
            <Link
              href="/vehicles/new"
              className="btn btn-primary inline-flex"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              创建第一辆车辆
            </Link>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    车牌号
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    品牌型号
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    动力类型
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    车辆类型
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状态
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    可用性
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    负责人
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    保险
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    年检到期
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredVehicles.map((vehicle) => {
                  const insuranceStatus = getInsuranceStatus(vehicle.policies);
                  return (
                  <tr key={vehicle.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{vehicle.plateNo}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{vehicle.brandModel}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {vehicle.powerType ? (
                        <span className={`badge ${
                          vehicle.powerType === 'EV' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {powerTypeLabels[vehicle.powerType as keyof typeof powerTypeLabels]}
                        </span>
                      ) : (
                        <div className="text-sm text-gray-400">-</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {vehicle.vehicleClass ? (
                        <span className="badge bg-indigo-100 text-indigo-700">
                          {vehicleClassLabels[vehicle.vehicleClass as keyof typeof vehicleClassLabels]}
                        </span>
                      ) : (
                        <div className="text-sm text-gray-400">-</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`badge ${
                          vehicle.status === 'IN_USE'
                            ? 'bg-green-100 text-green-700'
                            : vehicle.status === 'MAINTENANCE'
                            ? 'bg-yellow-100 text-yellow-700'
                            : vehicle.status === 'STOPPED'
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}
                      >
                        {statusLabels[vehicle.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`badge ${
                          vehicle.availability === 'AVAILABLE'
                            ? 'bg-blue-100 text-blue-700'
                            : vehicle.availability === 'RISK'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {availabilityLabels[vehicle.availability]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{vehicle.owner.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`badge ${
                          insuranceStatus === 'EXPIRED'
                            ? 'bg-red-100 text-red-700'
                            : insuranceStatus === 'EXPIRING'
                            ? 'bg-yellow-100 text-yellow-700'
                            : insuranceStatus === 'NORMAL'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {insuranceStatus === 'EXPIRED'
                          ? '已过期'
                          : insuranceStatus === 'EXPIRING'
                          ? '即将到期'
                          : insuranceStatus === 'NORMAL'
                          ? '正常'
                          : '无保单'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {vehicle.annualInspectionDueAt ? (
                        <div className="text-sm text-gray-900">
                          {new Date(vehicle.annualInspectionDueAt).toLocaleDateString('zh-CN')}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-400">-</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/vehicles/${vehicle.id}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        查看
                      </Link>
                      {(session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN') && (
                        <>
                          <span className="mx-2 text-gray-300">|</span>
                          <Link
                            href={`/vehicles/${vehicle.id}/edit`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            编辑
                          </Link>
                        </>
                      )}
                    </td>
                  </tr>
                );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                {page > 1 ? (
                  <Link
                    href={`/vehicles?page=${page - 1}${search ? `&search=${search}` : ''}${statusFilter ? `&status=${statusFilter}` : ''}${availabilityFilter ? `&availability=${availabilityFilter}` : ''}${insuranceStatusFilter ? `&insuranceStatus=${insuranceStatusFilter}` : ''}`}
                    className="btn btn-secondary"
                  >
                    上一页
                  </Link>
                ) : (
                  <div></div>
                )}
                {page < totalPages ? (
                  <Link
                    href={`/vehicles?page=${page + 1}${search ? `&search=${search}` : ''}${statusFilter ? `&status=${statusFilter}` : ''}${availabilityFilter ? `&availability=${availabilityFilter}` : ''}${insuranceStatusFilter ? `&insuranceStatus=${insuranceStatusFilter}` : ''}`}
                    className="btn btn-secondary"
                  >
                    下一页
                  </Link>
                ) : (
                  <div></div>
                )}
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    显示 <span className="font-medium">{skip + 1}</span> 到{' '}
                    <span className="font-medium">{Math.min(skip + pageSize, totalCount)}</span> 条，共{' '}
                    <span className="font-medium">{totalCount}</span> 条
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    {page > 1 ? (
                      <Link
                        href={`/vehicles?page=${page - 1}${search ? `&search=${search}` : ''}${statusFilter ? `&status=${statusFilter}` : ''}${availabilityFilter ? `&availability=${availabilityFilter}` : ''}${insuranceStatusFilter ? `&insuranceStatus=${insuranceStatusFilter}` : ''}`}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                      >
                        <span className="sr-only">上一页</span>
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </Link>
                    ) : (
                      <span className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-gray-100 text-sm font-medium text-gray-400 cursor-not-allowed">
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}
                    
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (page <= 3) {
                        pageNum = i + 1;
                      } else if (page >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = page - 2 + i;
                      }

                      return (
                        <Link
                          key={pageNum}
                          href={`/vehicles?page=${pageNum}${search ? `&search=${search}` : ''}${statusFilter ? `&status=${statusFilter}` : ''}${availabilityFilter ? `&availability=${availabilityFilter}` : ''}${insuranceStatusFilter ? `&insuranceStatus=${insuranceStatusFilter}` : ''}`}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            pageNum === page
                              ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </Link>
                      );
                    })}

                    {page < totalPages ? (
                      <Link
                        href={`/vehicles?page=${page + 1}${search ? `&search=${search}` : ''}${statusFilter ? `&status=${statusFilter}` : ''}${availabilityFilter ? `&availability=${availabilityFilter}` : ''}${insuranceStatusFilter ? `&insuranceStatus=${insuranceStatusFilter}` : ''}`}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                      >
                        <span className="sr-only">下一页</span>
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </Link>
                    ) : (
                      <span className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-gray-100 text-sm font-medium text-gray-400 cursor-not-allowed">
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
