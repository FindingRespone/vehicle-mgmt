import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ReminderCard } from '@/components/reminders/ReminderCard';

export default async function RemindersPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const userRole = session.user.role;
  const userId = session.user.id;

  // Build where clause based on role
  let whereClause: any = {
    status: {
      in: ['PENDING', 'SENT'],
    },
  };

  if (userRole === 'SUPER_ADMIN') {
    // Super admin can see all reminders
    whereClause = {
      ...whereClause,
    };
  } else if (userRole === 'ADMIN') {
    // Admin can see insurance and inspection reminders only
    whereClause = {
      ...whereClause,
      sourceType: {
        in: ['InsurancePolicy', 'AnnualInspection'],
      },
    };
  } else {
    // Vehicle member can only see reminders for their vehicles (insurance and inspection only)
    const userVehicleIds = await prisma.vehicleMember.findMany({
      where: {
        userId: userId,
      },
      select: {
        vehicleId: true,
      },
    });

    const vehicleIds = userVehicleIds.map((v) => v.vehicleId);

    // Also include vehicles where user is owner
    const ownedVehicles = await prisma.vehicle.findMany({
      where: {
        ownerId: userId,
      },
      select: {
        id: true,
      },
    });

    const allVehicleIds = [...vehicleIds, ...ownedVehicles.map((v) => v.id)];

    whereClause = {
      ...whereClause,
      vehicleId: {
        in: allVehicleIds,
      },
      sourceType: {
        in: ['InsurancePolicy', 'AnnualInspection'],
      },
    };
  }

  const reminders = await prisma.reminder.findMany({
    where: whereClause,
    include: {
      vehicle: {
        select: {
          id: true,
          plateNo: true,
          brandModel: true,
        },
      },
    },
    orderBy: [
      { dueDate: 'asc' },
      { createdAt: 'desc' },
    ],
  });

  // Count by status
  const pendingCount = reminders.filter((r) => r.status === 'PENDING').length;
  const sentCount = reminders.filter((r) => r.status === 'SENT').length;

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 pb-5">
        <h1 className="text-2xl font-semibold text-gray-900">待办提醒</h1>
        <p className="mt-2 text-sm text-gray-600">
          及时处理保险、年检和贷款到期事项，确保车辆合规运营
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="bg-white overflow-hidden border border-gray-200 rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">待处理</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">{pendingCount}</dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden border border-gray-200 rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">已发送</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">{sentCount}</dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden border border-gray-200 rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">总计</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">{reminders.length}</dd>
          </div>
        </div>
      </div>

      {reminders.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-lg">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">暂无待办提醒</h3>
          <p className="mt-1 text-sm text-gray-500">所有提醒已处理完成</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-200">
          {reminders.map((reminder) => (
            <ReminderCard
              key={reminder.id}
              reminder={reminder}
              userRole={userRole}
            />
          ))}
        </div>
      )}
    </div>
  );
}
