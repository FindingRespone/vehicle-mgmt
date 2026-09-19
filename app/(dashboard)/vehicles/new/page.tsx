import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import VehicleForm from '@/components/VehicleForm';

export default async function NewVehiclePage() {
  const session = await auth();

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/vehicles');
  }

  return (
    <div className="space-y-6">
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
        <h1 className="text-3xl font-bold text-gray-900">新建车辆</h1>
        <p className="mt-2 text-sm text-gray-600">填写车辆基本信息以创建新的车辆记录</p>
      </div>
      <VehicleForm />
    </div>
  );
}
