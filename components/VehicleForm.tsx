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
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm flex items-start">
          <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <div className="card p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            基本信息
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {isEdit ? '编辑' : '添加'}车辆的基本信息
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label htmlFor="plateNo" className="block text-sm font-medium text-gray-700 mb-2">
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
              placeholder="例: 京A12345"
              className="input-field disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
            />
            {isEdit && (
              <p className="mt-1.5 text-xs text-gray-500 flex items-center">
                <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                车牌号创建后不可修改
              </p>
            )}
          </div>

          <div>
            <label htmlFor="vin" className="block text-sm font-medium text-gray-700 mb-2">
              车架号 (VIN) <span className="text-gray-400 text-xs">选填</span>
            </label>
            <input
              type="text"
              name="vin"
              id="vin"
              value={formData.vin}
              onChange={handleChange}
              placeholder="17位车架号"
              className="input-field"
            />
            <p className="mt-1.5 text-xs text-gray-500">车辆识别代码，可留空</p>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="brandModel" className="block text-sm font-medium text-gray-700 mb-2">
              品牌型号 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="brandModel"
              id="brandModel"
              required
              value={formData.brandModel}
              onChange={handleChange}
              placeholder="例: 东风天龙 DFL3310A"
              className="input-field"
            />
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
              车辆状态
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="input-field"
            >
              <option value="IN_USE">使用中</option>
              <option value="MAINTENANCE">维护中</option>
              <option value="STOPPED">停用</option>
              <option value="DISPOSING">处置中</option>
            </select>
          </div>

          <div>
            <label htmlFor="availability" className="block text-sm font-medium text-gray-700 mb-2">
              可用性
            </label>
            <select
              id="availability"
              name="availability"
              value={formData.availability}
              onChange={handleChange}
              className="input-field"
            >
              <option value="AVAILABLE">可用</option>
              <option value="RISK">风险</option>
              <option value="UNAVAILABLE">不可用</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            年检信息
          </h2>
        </div>

        <div>
          <label htmlFor="annualInspectionDueAt" className="block text-sm font-medium text-gray-700 mb-2">
            年检到期日期 <span className="text-gray-400 text-xs">选填</span>
          </label>
          <input
            type="date"
            name="annualInspectionDueAt"
            id="annualInspectionDueAt"
            value={formData.annualInspectionDueAt}
            onChange={handleChange}
            className="input-field"
          />
          <p className="mt-1.5 text-xs text-gray-500">设置车辆年检到期日期以便提醒</p>
        </div>
      </div>

      <div className="card p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
            扩展信息
          </h2>
          <p className="mt-1 text-sm text-gray-600">预留扩展字段</p>
        </div>

        <div>
          <label htmlFor="remark" className="block text-sm font-medium text-gray-700 mb-2">
            备注 <span className="text-gray-400 text-xs">选填</span>
          </label>
          <textarea
            id="remark"
            name="remark"
            rows={4}
            value={formData.remark}
            onChange={handleChange}
            placeholder="可以记录车辆的其他相关信息..."
            className="input-field resize-none"
          />
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="btn btn-secondary"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary shadow-lg shadow-blue-500/30"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              保存中...
            </span>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {isEdit ? '保存修改' : '创建车辆'}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
