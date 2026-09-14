'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function VehicleForm({
  vehicle,
  isEdit = false,
}: {
  vehicle?: any;
  isEdit?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    plateNo: vehicle?.plateNo || '',
    vin: vehicle?.vin || '',
    brandModel: vehicle?.brandModel || '',
    status: vehicle?.status || 'IN_USE',
    availability: vehicle?.availability || 'AVAILABLE',
    annualInspectionDueAt: vehicle?.annualInspectionDueAt
      ? new Date(vehicle.annualInspectionDueAt).toISOString().split('T')[0]
      : '',
    remark: vehicle?.remark || '',
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const url = isEdit ? `/api/vehicles/${vehicle.id}` : '/api/vehicles';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          annualInspectionDueAt: formData.annualInspectionDueAt
            ? new Date(formData.annualInspectionDueAt).toISOString()
            : null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '操作失败');
      }

      const result = await response.json();
      router.push(`/vehicles/${result.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
        <div className="md:grid md:grid-cols-3 md:gap-6">
          <div className="md:col-span-1">
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              基本信息
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {isEdit ? '编辑' : '添加'}车辆的基本信息
            </p>
          </div>
          <div className="mt-5 md:mt-0 md:col-span-2">
            <div className="grid grid-cols-6 gap-6">
              <div className="col-span-6 sm:col-span-3">
                <label
                  htmlFor="plateNo"
                  className="block text-sm font-medium text-gray-700"
                >
                  车牌号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="plateNo"
                  id="plateNo"
                  required
                  value={formData.plateNo}
                  onChange={handleChange}
                  disabled={isEdit}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900 disabled:bg-gray-100"
                />
              </div>

              <div className="col-span-6 sm:col-span-3">
                <label
                  htmlFor="vin"
                  className="block text-sm font-medium text-gray-700"
                >
                  车架号 (VIN)
                </label>
                <input
                  type="text"
                  name="vin"
                  id="vin"
                  value={formData.vin}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
                />
              </div>

              <div className="col-span-6">
                <label
                  htmlFor="brandModel"
                  className="block text-sm font-medium text-gray-700"
                >
                  品牌型号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="brandModel"
                  id="brandModel"
                  required
                  value={formData.brandModel}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
                />
              </div>

              <div className="col-span-6 sm:col-span-3">
                <label
                  htmlFor="status"
                  className="block text-sm font-medium text-gray-700"
                >
                  车辆状态
                </label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
                >
                  <option value="IN_USE">使用中</option>
                  <option value="MAINTENANCE">维护中</option>
                  <option value="STOPPED">停用</option>
                  <option value="DISPOSING">处置中</option>
                </select>
              </div>

              <div className="col-span-6 sm:col-span-3">
                <label
                  htmlFor="availability"
                  className="block text-sm font-medium text-gray-700"
                >
                  可用性
                </label>
                <select
                  id="availability"
                  name="availability"
                  value={formData.availability}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
                >
                  <option value="AVAILABLE">可用</option>
                  <option value="RISK">风险</option>
                  <option value="UNAVAILABLE">不可用</option>
                </select>
              </div>

              <div className="col-span-6 sm:col-span-3">
                <label
                  htmlFor="annualInspectionDueAt"
                  className="block text-sm font-medium text-gray-700"
                >
                  年检到期日期
                </label>
                <input
                  type="date"
                  name="annualInspectionDueAt"
                  id="annualInspectionDueAt"
                  value={formData.annualInspectionDueAt}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
                />
              </div>

              <div className="col-span-6">
                <label
                  htmlFor="remark"
                  className="block text-sm font-medium text-gray-700"
                >
                  备注
                </label>
                <textarea
                  id="remark"
                  name="remark"
                  rows={3}
                  value={formData.remark}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-gray-900"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '保存中...' : isEdit ? '保存修改' : '创建车辆'}
        </button>
      </div>
    </form>
  );
}
