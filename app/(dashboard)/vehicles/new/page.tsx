import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import VehicleForm from '@/components/VehicleForm';

export default async function NewVehiclePage() {
  const session = await auth();

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/vehicles');
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">新增车辆</h1>
      </div>
      <VehicleForm />
    </div>
  );
}
