'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Attachment {
  id: string;
  category: string;
  filename: string;
  originalFilename: string;
  filesize: number;
  mimeType: string;
  uploadedBy: string | null;
  createdAt: string;
  supersededAt: string | null;
}

interface InsurancePolicy {
  id: string;
  policyNo: string;
  insuranceCompany: string;
  insuranceType: string;
  startDate: string;
  endDate: string;
  premium: string;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: Attachment[];
}

export default function InsurancePolicySection({
  vehicleId,
  canManage = false,
}: {
  vehicleId: string;
  canManage?: boolean;
}) {
  const router = useRouter();
  
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showRenewForm, setShowRenewForm] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    policyNo: '',
    insuranceCompany: '',
    insuranceType: '',
    startDate: '',
    endDate: '',
    premium: '',
    remark: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedAttachmentId, setUploadedAttachmentId] = useState<string | null>(null);

  useEffect(() => {
    fetchPolicies();
  }, [vehicleId]);

  const fetchPolicies = async () => {
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/policies`);
      if (response.ok) {
        const data = await response.json();
        setPolicies(data);
      }
    } catch (err) {
      console.error('Failed to fetch policies:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      policyNo: '',
      insuranceCompany: '',
      insuranceType: '',
      startDate: '',
      endDate: '',
      premium: '',
      remark: '',
    });
    setSelectedFile(null);
    setUploadedAttachmentId(null);
    setShowCreateForm(false);
    setShowRenewForm(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setError('');

    // Auto-upload the file
    const formDataFile = new FormData();
    formDataFile.append('file', file);
    formDataFile.append('category', 'INSURANCE');

    setUploading(true);
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/attachments`, {
        method: 'POST',
        body: formDataFile,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '上传失败');
      }

      const attachment = await response.json();
      setUploadedAttachmentId(attachment.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败，请重试');
      setSelectedFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = async () => {
    if (!uploadedAttachmentId) {
      setError('请上传保单照片');
      return;
    }

    if (!formData.policyNo || !formData.insuranceCompany || !formData.insuranceType || 
        !formData.startDate || !formData.endDate || !formData.premium) {
      setError('请填写所有必填字段');
      return;
    }

    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/policies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          attachmentId: uploadedAttachmentId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '创建失败');
      }

      setSuccess('保单创建成功');
      resetForm();
      await fetchPolicies();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败，请重试');
    }
  };

  const handleRenew = async (policyId: string) => {
    if (!uploadedAttachmentId) {
      setError('续保必须上传新保单照片');
      return;
    }

    if (!formData.endDate) {
      setError('请填写新的到期日期');
      return;
    }

    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/policies/${policyId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endDate: formData.endDate,
          newAttachmentId: uploadedAttachmentId,
          ...(formData.premium && { premium: formData.premium }),
          ...(formData.remark !== undefined && { remark: formData.remark }),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '续保失败');
      }

      setSuccess('续保成功');
      resetForm();
      await fetchPolicies();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '续保失败，请重试');
    }
  };

  const handleDelete = async (policyId: string, policyNo: string) => {
    if (!confirm(`确定要删除保单「${policyNo}」吗？`)) {
      return;
    }

    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/policies/${policyId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '删除失败');
      }

      setSuccess('删除成功');
      await fetchPolicies();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败，请重试');
    }
  };

  const getDaysToExpiry = (endDate: string) => {
    const now = new Date();
    const end = new Date(endDate);
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getExpiryBadge = (endDate: string) => {
    const days = getDaysToExpiry(endDate);
    
    if (days < 0) {
      return <span className="badge bg-red-100 text-red-700">已过期 {Math.abs(days)} 天</span>;
    } else if (days <= 7) {
      return <span className="badge bg-red-100 text-red-700">即将过期 ({days} 天)</span>;
    } else if (days <= 30) {
      return <span className="badge bg-yellow-100 text-yellow-700">{days} 天后到期</span>;
    } else {
      return <span className="badge bg-green-100 text-green-700">{days} 天后到期</span>;
    }
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center">
          <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          保单管理
        </h2>
        {canManage && !showCreateForm && !showRenewForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn btn-primary text-sm"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新增保单
          </button>
        )}
      </div>

      {(error || success) && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm flex items-start ${
          error ? 'bg-red-50 border border-red-200 text-red-600' : 'bg-green-50 border border-green-200 text-green-600'
        }`}>
          <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            {error ? (
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            ) : (
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            )}
          </svg>
          <span>{error || success}</span>
        </div>
      )}

      {showCreateForm && (
        <div className="mb-6 p-5 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">新增保单</h3>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">保单号 *</label>
              <input
                type="text"
                value={formData.policyNo}
                onChange={(e) => setFormData({ ...formData, policyNo: e.target.value })}
                className="input-field text-sm"
                placeholder="请输入保单号"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">保险公司 *</label>
              <input
                type="text"
                value={formData.insuranceCompany}
                onChange={(e) => setFormData({ ...formData, insuranceCompany: e.target.value })}
                className="input-field text-sm"
                placeholder="如：平安保险"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">险种 *</label>
              <select
                value={formData.insuranceType}
                onChange={(e) => setFormData({ ...formData, insuranceType: e.target.value })}
                className="input-field text-sm"
              >
                <option value="">请选择险种</option>
                <option value="交强险">交强险</option>
                <option value="商业险">商业险</option>
                <option value="交强险+商业险">交强险+商业险</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">保费 (元) *</label>
              <input
                type="number"
                step="0.01"
                value={formData.premium}
                onChange={(e) => setFormData({ ...formData, premium: e.target.value })}
                className="input-field text-sm"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">起保日期 *</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">到期日期 *</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="input-field text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">保单照片 * {uploading && <span className="text-blue-600">(上传中...)</span>}</label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileChange}
                disabled={uploading}
                className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
              {uploadedAttachmentId && (
                <p className="mt-1 text-xs text-green-600 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  已上传
                </p>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">备注</label>
              <textarea
                value={formData.remark}
                onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                rows={2}
                className="input-field text-sm"
                placeholder="选填"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-4">
            <button onClick={resetForm} className="btn btn-secondary text-sm">
              取消
            </button>
            <button 
              onClick={handleCreate} 
              disabled={!uploadedAttachmentId}
              className="btn btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              创建保单
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-500">
          <svg className="animate-spin h-8 w-8 mx-auto mb-2 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          加载中...
        </div>
      ) : policies.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <p className="text-sm">暂无保单</p>
          {canManage && <p className="text-xs text-gray-400 mt-1">请添加车辆保险信息</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {policies.map((policy) => {
            const activeAttachments = policy.attachments.filter(a => !a.supersededAt);
            const supersededAttachments = policy.attachments.filter(a => a.supersededAt);
            const isRenewing = showRenewForm === policy.id;
            
            return (
              <div key={policy.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-base font-semibold text-gray-900">{policy.insuranceCompany}</h3>
                      <span className="badge bg-blue-100 text-blue-700">{policy.insuranceType}</span>
                      {getExpiryBadge(policy.endDate)}
                    </div>
                    <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <dt className="text-xs text-gray-500 mb-0.5">保单号</dt>
                        <dd className="font-medium text-gray-900">{policy.policyNo}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500 mb-0.5">起保日期</dt>
                        <dd className="text-gray-900">{new Date(policy.startDate).toLocaleDateString('zh-CN')}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500 mb-0.5">到期日期</dt>
                        <dd className="text-gray-900">{new Date(policy.endDate).toLocaleDateString('zh-CN')}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-500 mb-0.5">保费</dt>
                        <dd className="text-gray-900 font-semibold">¥{Number(policy.premium).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</dd>
                      </div>
                    </dl>
                    {policy.remark && (
                      <p className="text-xs text-gray-600 mt-2 bg-gray-50 p-2 rounded">{policy.remark}</p>
                    )}
                  </div>
                  {canManage && !isRenewing && (
                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={() => {
                          setShowRenewForm(policy.id);
                          setFormData({
                            ...formData,
                            endDate: '',
                            premium: policy.premium,
                            remark: policy.remark || '',
                          });
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                      >
                        续保
                      </button>
                      <button
                        onClick={() => handleDelete(policy.id, policy.policyNo)}
                        className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                      >
                        删除
                      </button>
                    </div>
                  )}
                </div>

                {isRenewing && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-900">续保</h4>
                      <button 
                        onClick={resetForm}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">新到期日期 *</label>
                        <input
                          type="date"
                          value={formData.endDate}
                          onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                          className="input-field text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">新保费 (元)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.premium}
                          onChange={(e) => setFormData({ ...formData, premium: e.target.value })}
                          className="input-field text-sm"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">新保单照片 * {uploading && <span className="text-blue-600">(上传中...)</span>}</label>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={handleFileChange}
                          disabled={uploading}
                          className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                        />
                        {uploadedAttachmentId && (
                          <p className="mt-1 text-xs text-green-600 flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            已上传
                          </p>
                        )}
                        <p className="mt-1 text-xs text-gray-500">续保必须上传新保单照片，旧照片会保留在历史记录中</p>
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2 mt-3">
                      <button onClick={resetForm} className="btn btn-secondary text-sm">
                        取消
                      </button>
                      <button 
                        onClick={() => handleRenew(policy.id)}
                        disabled={!uploadedAttachmentId || !formData.endDate}
                        className="btn btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        确认续保
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-3 space-y-2">
                  <div>
                    <h4 className="text-xs font-medium text-gray-700 mb-2">保单照片</h4>
                    {activeAttachments.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {activeAttachments.map((att) => (
                          <a
                            key={att.id}
                            href={`/api/vehicles/${vehicleId}/attachments/${att.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-20 h-20 border-2 border-green-500 rounded overflow-hidden hover:opacity-90 transition-opacity"
                            title="当前保单照片"
                          >
                            {att.mimeType.startsWith('image/') ? (
                              <img
                                src={`/api/vehicles/${vehicleId}/attachments/${att.id}`}
                                alt={att.originalFilename}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">无照片</p>
                    )}
                  </div>
                  {supersededAttachments.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 mb-2">历史保单照片</h4>
                      <div className="flex flex-wrap gap-2">
                        {supersededAttachments.map((att) => (
                          <a
                            key={att.id}
                            href={`/api/vehicles/${vehicleId}/attachments/${att.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-20 h-20 border border-gray-300 rounded overflow-hidden opacity-60 hover:opacity-100 transition-opacity"
                            title={`已被替换 (${new Date(att.supersededAt!).toLocaleDateString('zh-CN')})`}
                          >
                            {att.mimeType.startsWith('image/') ? (
                              <img
                                src={`/api/vehicles/${vehicleId}/attachments/${att.id}`}
                                alt={att.originalFilename}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
