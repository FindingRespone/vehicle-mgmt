'use client';

import { useEffect, useState } from 'react';
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

interface DrivingLicenseMeta {
  vehicleType?: string;
  ownerName?: string;
  useNature?: string;
}

export default function DrivingLicenseSection({
  vehicleId,
  canManage = false,
}: {
  vehicleId: string;
  canManage?: boolean;
}) {
  const router = useRouter();

  const [vin, setVin] = useState('');
  const [brandModel, setBrandModel] = useState('');
  const [meta, setMeta] = useState<DrivingLicenseMeta>({});
  const [frontImages, setFrontImages] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    ownerName: '',
    vin: '',
    brandModel: '',
    vehicleType: '',
    useNature: '',
  });
  const [uploadedAttachmentId, setUploadedAttachmentId] = useState<string | null>(null);

  useEffect(() => {
    fetchLicense();
  }, [vehicleId]);

  const fetchLicense = async () => {
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/driving-license`);
      if (response.ok) {
        const data = await response.json();
        setVin(data.vin || '');
        setBrandModel(data.brandModel || '');
        setMeta(data.meta || {});
        setFrontImages(data.frontImages || []);
      }
    } catch (err) {
      console.error('Failed to fetch driving license:', err);
    } finally {
      setLoading(false);
    }
  };

  const activeFrontImages = frontImages.filter((a) => !a.supersededAt);
  const historyFrontImages = frontImages.filter((a) => a.supersededAt);
  const hasMeta = Boolean(meta.vehicleType || meta.ownerName || meta.useNature);
  const hasFrontImage = activeFrontImages.length > 0;
  const hasRecord = hasMeta || Boolean(vin) || Boolean(brandModel) || frontImages.length > 0;

  const currentForm = () => ({
    ownerName: meta.ownerName || '',
    vin,
    brandModel,
    vehicleType: meta.vehicleType || '',
    useNature: meta.useNature || '',
  });

  const resetForm = () => {
    setShowForm(false);
    setUploadedAttachmentId(null);
    setError('');
    setFormData(currentForm());
  };

  const openForm = () => {
    setError('');
    setSuccess('');
    setUploadedAttachmentId(null);
    setFormData(currentForm());
    setShowForm(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    const formDataFile = new FormData();
    formDataFile.append('file', file);
    formDataFile.append('category', 'DRIVING_LICENSE');

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
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!uploadedAttachmentId && !hasFrontImage) {
      setError('请上传行驶证正面图片');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/driving-license`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          attachmentId: uploadedAttachmentId || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '保存失败');
      }

      const data = await response.json();
      setVin(data.vin || '');
      setBrandModel(data.brandModel || '');
      setMeta(data.meta || {});
      setFrontImages(data.frontImages || []);
      setSuccess('行驶证信息已保存');
      setShowForm(false);
      setUploadedAttachmentId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const renderImage = (att: Attachment, current = false) => (
    <a
      key={att.id}
      href={`/api/vehicles/${vehicleId}/attachments/${att.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`block w-20 h-20 rounded overflow-hidden hover:opacity-90 transition-opacity ${
        current ? 'border-2 border-green-500' : 'border border-gray-300 opacity-60 hover:opacity-100'
      }`}
      title={current ? '行驶证正面' : `历史正面图 (${new Date(att.supersededAt!).toLocaleDateString('zh-CN')})`}
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
  );

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center">
          <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          行驶证信息
        </h2>
        {canManage && !showForm && (
          <button onClick={openForm} className="btn btn-primary text-sm">
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {hasRecord ? '编辑行驶证' : '填写行驶证信息'}
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

      {showForm && (
        <div className="mb-6 p-5 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">{hasRecord ? '编辑行驶证信息' : '填写行驶证信息'}</h3>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">所有人</label>
              <input
                type="text"
                value={formData.ownerName}
                onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">车架号 (VIN)</label>
              <input
                type="text"
                value={formData.vin}
                onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
                className="input-field text-sm"
                placeholder="17位车架号"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">品牌型号</label>
              <input
                type="text"
                value={formData.brandModel}
                onChange={(e) => setFormData({ ...formData, brandModel: e.target.value })}
                className="input-field text-sm"
                placeholder="例: 东风天龙 DFL3310A"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">车辆类型</label>
              <input
                type="text"
                value={formData.vehicleType}
                onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                className="input-field text-sm"
                placeholder="如：重型厢式货车"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">使用性质</label>
              <input
                type="text"
                value={formData.useNature}
                onChange={(e) => setFormData({ ...formData, useNature: e.target.value })}
                className="input-field text-sm"
                placeholder="如：货运"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                行驶证正面图片 * {uploading && <span className="text-blue-600">(上传中...)</span>}
              </label>
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
                  已上传正面图片
                </p>
              )}
              {!uploadedAttachmentId && hasFrontImage && (
                <p className="mt-1 text-xs text-gray-500">已有正面图片，不重新上传则继续沿用</p>
              )}
              {!uploadedAttachmentId && !hasFrontImage && (
                <p className="mt-1 text-xs text-gray-500">保存行驶证信息必须上传正面图片</p>
              )}
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-4">
            <button onClick={resetForm} className="btn btn-secondary text-sm">
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving || uploading || (!uploadedAttachmentId && !hasFrontImage)}
              className="btn btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? '保存中...' : '保存'}
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
      ) : !hasRecord && !showForm ? (
        <div className="text-center py-12 text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm">暂无行驶证信息</p>
          {canManage && <p className="text-xs text-gray-400 mt-1">填写基本信息并上传正面图片</p>}
        </div>
      ) : hasRecord && !showForm ? (
        <div className="space-y-4">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">所有人</dt>
              <dd className="text-sm text-gray-900">{meta.ownerName || <span className="text-gray-400">未填写</span>}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">车架号 (VIN)</dt>
              <dd className="text-sm text-gray-900">{vin || <span className="text-gray-400">未填写</span>}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">品牌型号</dt>
              <dd className="text-sm text-gray-900">{brandModel || <span className="text-gray-400">未填写</span>}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">车辆类型</dt>
              <dd className="text-sm text-gray-900">{meta.vehicleType || <span className="text-gray-400">未填写</span>}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">使用性质</dt>
              <dd className="text-sm text-gray-900">{meta.useNature || <span className="text-gray-400">未填写</span>}</dd>
            </div>
          </dl>
          <div>
            <h4 className="text-xs font-medium text-gray-700 mb-2">行驶证正面</h4>
            {activeFrontImages.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {activeFrontImages.map((att) => renderImage(att, true))}
              </div>
            ) : (
              <p className="text-xs text-gray-500">未上传正面图片</p>
            )}
          </div>
          {historyFrontImages.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 mb-2">历史正面图</h4>
              <div className="flex flex-wrap gap-2">
                {historyFrontImages.map((att) => renderImage(att))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
