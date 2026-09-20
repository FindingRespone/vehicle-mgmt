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
}

const categoryLabels = {
  DRIVING_LICENSE: '行驶证',
  VEHICLE_PHOTO: '车辆照片',
  INSURANCE: '保险单',
  LOAN_CONTRACT: '贷款合同',
  OTHER: '其他',
};

const categoryColors = {
  DRIVING_LICENSE: 'bg-blue-100 text-blue-700',
  VEHICLE_PHOTO: 'bg-green-100 text-green-700',
  INSURANCE: 'bg-purple-100 text-purple-700',
  LOAN_CONTRACT: 'bg-orange-100 text-orange-700',
  OTHER: 'bg-gray-100 text-gray-700',
};

export default function AttachmentSection({
  vehicleId,
  canUpload = true,
  userRole = 'VEHICLE_MEMBER',
}: {
  vehicleId: string;
  canUpload?: boolean;
  userRole?: 'ADMIN' | 'VEHICLE_MEMBER' | 'SUPER_ADMIN' | 'FINANCE_READONLY';
}) {
  const router = useRouter();
  const canManageAttachments = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
  const canAccessLoan = userRole === 'SUPER_ADMIN';
  
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('DRIVING_LICENSE');

  useEffect(() => {
    if (!canAccessLoan && selectedCategory === 'LOAN_CONTRACT') {
      setSelectedCategory('DRIVING_LICENSE');
    }
  }, [canAccessLoan, selectedCategory]);

  useEffect(() => {
    fetchAttachments();
  }, [vehicleId]);

  const fetchAttachments = async () => {
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/attachments`);
      if (response.ok) {
        const data = await response.json();
        setAttachments(data);
      }
    } catch (err) {
      console.error('Failed to fetch attachments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError('');
      setSuccess('');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('请选择文件');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('category', selectedCategory);

      const response = await fetch(`/api/vehicles/${vehicleId}/attachments`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '上传失败');
      }

      setSuccess('上传成功');
      setSelectedFile(null);
      
      // Reset file input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }

      await fetchAttachments();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (attachmentId: string, filename: string) => {
    if (!confirm(`确定要删除 "${filename}" 吗？`)) {
      return;
    }

    try {
      const response = await fetch(
        `/api/vehicles/${vehicleId}/attachments/${attachmentId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '删除失败');
      }

      setSuccess('删除成功');
      await fetchAttachments();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败，请重试');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const hasDrivingLicense = attachments.some(a => a.category === 'DRIVING_LICENSE');
  const hasVehiclePhoto = attachments.some(a => a.category === 'VEHICLE_PHOTO');
  const isMissing = !hasDrivingLicense || !hasVehiclePhoto;

  const getMissingDocsText = () => {
    const missing: string[] = [];
    if (!hasDrivingLicense) missing.push('行驶证图片');
    if (!hasVehiclePhoto) missing.push('车辆外观照片');
    return missing.length > 0 ? `缺少：${missing.join('、')}` : '';
  };

  const availableCategories = canManageAttachments
    ? Object.keys(categoryLabels).filter(
        (c) => c !== 'LOAN_CONTRACT' || canAccessLoan
      )
    : [];

  const visibleAttachments = attachments;

  const groupedAttachments = visibleAttachments.reduce((acc, attachment) => {
    if (!acc[attachment.category]) {
      acc[attachment.category] = [];
    }
    acc[attachment.category].push(attachment);
    return acc;
  }, {} as Record<string, Attachment[]>);

  const isImage = (mimeType: string) => {
    return mimeType.startsWith('image/');
  };

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            证照与照片
          </h2>
          {isMissing && (
            <span 
              className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800 mt-2 cursor-help" 
              title={getMissingDocsText()}
            >
              <svg className="w-3.5 h-3.5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              影像不完整
            </span>
          )}
        </div>
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

      {canManageAttachments && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                选择类别
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="input-field text-sm"
              >
                {availableCategories.map((category) => (
                  <option key={category} value={category}>
                    {categoryLabels[category as keyof typeof categoryLabels]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                选择文件
              </label>
              <input
                id="file-upload"
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
              <p className="mt-1 text-xs text-gray-500">
                支持图片和PDF，最大10MB
              </p>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    上传中...
                  </span>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    上传
                  </>
                )}
              </button>
            </div>
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
      ) : visibleAttachments.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">暂无附件</p>
          {canManageAttachments && <p className="text-xs text-gray-400 mt-1">请上传行驶证和车辆照片</p>}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedAttachments).map(([category, items]) => (
            <div key={category}>
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                <span className={`badge ${categoryColors[category as keyof typeof categoryColors]} mr-2`}>
                  {categoryLabels[category as keyof typeof categoryLabels]}
                </span>
                <span className="text-gray-400">({items.length})</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow"
                  >
                    {isImage(attachment.mimeType) ? (
                      <a
                        href={`/api/vehicles/${vehicleId}/attachments/${attachment.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block mb-2"
                      >
                        <img
                          src={`/api/vehicles/${vehicleId}/attachments/${attachment.id}`}
                          alt={attachment.originalFilename}
                          className="w-full h-32 object-cover rounded cursor-pointer hover:opacity-90 transition-opacity"
                        />
                      </a>
                    ) : (
                      <a
                        href={`/api/vehicles/${vehicleId}/attachments/${attachment.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center h-32 bg-gray-100 rounded mb-2 hover:bg-gray-200 transition-colors"
                      >
                        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </a>
                    )}
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-gray-900 truncate" title={attachment.originalFilename}>
                        {attachment.originalFilename}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{formatFileSize(attachment.filesize)}</span>
                        <span>{new Date(attachment.createdAt).toLocaleDateString('zh-CN')}</span>
                      </div>
                      {canManageAttachments && (attachment.category !== 'LOAN_CONTRACT' || canAccessLoan) && (
                        <button
                          onClick={() => handleDelete(attachment.id, attachment.originalFilename)}
                          className="w-full mt-2 px-2 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors flex items-center justify-center"
                        >
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          删除
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
