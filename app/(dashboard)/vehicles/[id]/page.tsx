import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import AttachmentSection from '@/components/AttachmentSection';
import VehicleMemberManagement from '@/components/VehicleMemberManagement';
import InsurancePolicySection from '@/components/InsurancePolicySection';

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

const powerTypeLabels = {
  EV: '电车',
  FUEL: '油车',
};

const vehicleClassLabels = {
  TRUCK_4_2: '4.2米货车',
  OTHER: '其他车型',
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
          id: true,
          name: true,
          username: true,
        },
      },
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
            },
          },
        },
      },
      attachments: {
        where: {
          deletedAt: null,
        },
        select: {
          category: true,
        },
      },
    },
  });

  if (!vehicle) {
    notFound();
  }

  const isManager =
    session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN';

  if (!isManager) {
    const isMember = vehicle.members.some((m) => m.userId === session.user.id);
    if (vehicle.ownerUserId !== session.user.id && !isMember) {
      redirect('/vehicles');
    }
  }

  const hasDrivingLicense = vehicle.attachments.some(a => a.category === 'DRIVING_LICENSE');
  const hasVehiclePhoto = vehicle.attachments.some(a => a.category === 'VEHICLE_PHOTO');
  const isMissingDocs = !hasDrivingLicense || !hasVehiclePhoto;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/vehicles"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-3 group"
          >
            <svg className="w-4 h-4 mr-1 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            返回车辆列表
          </Link>
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {vehicle.plateNo}
              </h1>
              <p className="text-gray-600 mt-1">{vehicle.brandModel}</p>
            </div>
          </div>
        </div>
        {isManager && (
          <Link
            href={`/vehicles/${vehicle.id}/edit`}
            className="btn btn-primary"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            编辑
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              基本信息
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">车牌号</dt>
                <dd className="text-sm font-semibold text-gray-900">{vehicle.plateNo}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">车架号 (VIN)</dt>
                <dd className="text-sm text-gray-900">{vehicle.vin || <span className="text-gray-400">未填写</span>}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">品牌型号</dt>
                <dd className="text-sm font-medium text-gray-900">{vehicle.brandModel}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">负责人</dt>
                <dd className="text-sm text-gray-900 flex items-center">
                  <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {vehicle.owner.name}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">动力类型</dt>
                <dd>
                  {vehicle.powerType ? (
                    <span className={`badge ${
                      vehicle.powerType === 'EV' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {powerTypeLabels[vehicle.powerType as keyof typeof powerTypeLabels]}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">未填写</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">车辆类型</dt>
                <dd>
                  {vehicle.vehicleClass ? (
                    <span className="badge bg-indigo-100 text-indigo-700">
                      {vehicleClassLabels[vehicle.vehicleClass as keyof typeof vehicleClassLabels]}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">未填写</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              年检信息
            </h2>
            <dl className="space-y-4">
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">年检到期日期</dt>
                <dd className="text-sm text-gray-900 flex items-center">
                  <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {vehicle.annualInspectionDueAt
                    ? new Date(vehicle.annualInspectionDueAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
                    : <span className="text-gray-400">未设置</span>}
                </dd>
              </div>
            </dl>
          </div>

          <InsurancePolicySection vehicleId={vehicle.id} canManage={isManager} />

          <AttachmentSection vehicleId={vehicle.id} canUpload={isManager} userRole={session.user.role} />

          {isManager && (
            <VehicleMemberManagement
              vehicleId={vehicle.id}
              initialOwner={{
                id: vehicle.owner.id,
                name: vehicle.owner.name,
                username: vehicle.owner.username,
              }}
              initialMembers={vehicle.members.map((m) => ({
                id: m.id,
                userId: m.userId,
                user: {
                  id: m.user.id,
                  name: m.user.name,
                  username: m.user.username,
                  role: '',
                },
              }))}
            />
          )}

          {vehicle.remark && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                备注
              </h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {vehicle.remark}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">状态</h2>
            <div className="space-y-3">
              <div>
                <dt className="text-xs text-gray-500 mb-1.5">车辆状态</dt>
                <dd>
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
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 mb-1.5">可用性</dt>
                <dd>
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
                </dd>
              </div>
              {isMissingDocs && (
                <div>
                  <dt className="text-xs text-gray-500 mb-1.5">证照状态</dt>
                  <dd>
                    <span 
                      className="badge bg-yellow-100 text-yellow-800 cursor-help" 
                      title={`缺少：${!hasDrivingLicense ? '行驶证图片' : ''}${!hasDrivingLicense && !hasVehiclePhoto ? '、' : ''}${!hasVehiclePhoto ? '车辆外观照片' : ''}`}
                    >
                      影像不完整
                    </span>
                  </dd>
                </div>
              )}
            </div>
          </div>

          {vehicle.members.length > 0 && (
            <div className="card p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">关联成员</h2>
              <ul className="space-y-2">
                {vehicle.members.map((member) => (
                  <li key={member.id} className="flex items-center text-sm">
                    <div className="w-7 h-7 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-medium text-xs mr-2">
                      {member.user.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{member.user.name}</p>
                      <p className="text-xs text-gray-500">{member.user.username}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wider">时间戳</h2>
            <dl className="space-y-3 text-xs">
              <div>
                <dt className="text-gray-500 mb-1">创建时间</dt>
                <dd className="text-gray-900 font-mono">
                  {new Date(vehicle.createdAt).toLocaleString('zh-CN')}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 mb-1">更新时间</dt>
                <dd className="text-gray-900 font-mono">
                  {new Date(vehicle.updatedAt).toLocaleString('zh-CN')}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
