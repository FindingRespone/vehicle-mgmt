import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import VehicleForm from '@/components/VehicleForm';

export default async function EditVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/vehicles');
  }

  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
  });

  if (!vehicle) {
    notFound();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">编辑车辆</h1>
        <p className="mt-1 text-sm text-gray-600">{vehicle.plateNo}</p>
      </div>
      <VehicleForm vehicle={vehicle} isEdit={true} />
    </div>
  );
}
