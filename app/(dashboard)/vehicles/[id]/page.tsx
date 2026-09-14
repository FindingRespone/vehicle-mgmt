import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
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

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  if (!session) {
    redirect('/login');
  }

  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      owner: {
        select: {
          name: true,
        },
      },
      members: {
        include: {
          user: {
            select: {
              name: true,
              username: true,
            },
          },
        },
      },
    },
  });

  if (!vehicle) {
    notFound();
  }

  if (session.user.role !== 'ADMIN') {
    const isMember = vehicle.members.some((m) => m.userId === session.user.id);
    if (vehicle.ownerUserId !== session.user.id && !isMember) {
      redirect('/vehicles');
    }
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-start">
        <div>
          <Link
            href="/vehicles"
            className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
          >
            ← 返回车辆列表
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900">
            {vehicle.plateNo}
          </h1>
        </div>
        {session.user.role === 'ADMIN' && (
          <Link
            href={`/vehicles/${vehicle.id}/edit`}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            编辑
          </Link>
        )}
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            车辆详细信息
          </h3>
        </div>
        <div className="border-t border-gray-200">
          <dl>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">车牌号</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {vehicle.plateNo}
              </dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">车架号 (VIN)</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {vehicle.vin || '未填写'}
              </dd>
            </div>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">品牌型号</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {vehicle.brandModel}
              </dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">车辆状态</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
              </dd>
            </div>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">可用性</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
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
              </dd>
            </div>
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">车主</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {vehicle.owner.name}
              </dd>
            </div>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">年检到期日期</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {vehicle.annualInspectionDueAt
                  ? new Date(vehicle.annualInspectionDueAt).toLocaleDateString(
                      'zh-CN'
                    )
                  : '未设置'}
              </dd>
            </div>
            {vehicle.members.length > 0 && (
              <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">关联成员</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  <ul className="space-y-1">
                    {vehicle.members.map((member) => (
                      <li key={member.id}>
                        {member.user.name} ({member.user.username})
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
            {vehicle.remark && (
              <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">备注</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 whitespace-pre-wrap">
                  {vehicle.remark}
                </dd>
              </div>
            )}
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">创建时间</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {new Date(vehicle.createdAt).toLocaleString('zh-CN')}
              </dd>
            </div>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">更新时间</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {new Date(vehicle.updatedAt).toLocaleString('zh-CN')}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
