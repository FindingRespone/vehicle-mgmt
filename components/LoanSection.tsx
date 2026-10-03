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

interface LoanInstallment {
  id: string;
  periodNumber: number;
  dueDate: string;
  paidAt: string | null;
}

interface Loan {
  id: string;
  lender: string;
  loanAmount: string;
  interestRate: string;
  startDate: string;
  endDate: string;
  monthlyPayment: string;
  installmentCount: number;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
  attachments: Attachment[];
  installments: LoanInstallment[];
}

export default function LoanSection({
  vehicleId,
}: {
  vehicleId: string;
}) {
  const router = useRouter();
  
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    lender: '',
    loanAmount: '',
    interestRate: '',
    startDate: '',
    endDate: '',
    monthlyPayment: '',
    installmentCount: '',
    remark: '',
  });
  const [installments, setInstallments] = useState<{ dueDate: string; paidAt?: string }[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedAttachmentId, setUploadedAttachmentId] = useState<string | null>(null);

  useEffect(() => {
    fetchLoans();
  }, [vehicleId]);

  const fetchLoans = async () => {
    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/loans`);
      if (response.ok) {
        const data = await response.json();
        setLoans(data);
      } else if (response.status === 403) {
        // User doesn't have permission to view loans
        setLoading(false);
        return;
      }
    } catch (err) {
      console.error('Failed to fetch loans:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      lender: '',
      loanAmount: '',
      interestRate: '',
      startDate: '',
      endDate: '',
      monthlyPayment: '',
      installmentCount: '',
      remark: '',
    });
    setInstallments([]);
    setSelectedFile(null);
    setUploadedAttachmentId(null);
    setShowCreateForm(false);
    setEditingLoanId(null);
  };

  const generateInstallments = (startDate: string, count: number) => {
    if (!startDate || count < 1) return [];
    
    const start = new Date(startDate);
    const newInstallments: { dueDate: string }[] = [];
    
    for (let i = 0; i < count; i++) {
      const dueDate = new Date(start);
      dueDate.setMonth(start.getMonth() + i + 1);
      newInstallments.push({
        dueDate: dueDate.toISOString().split('T')[0],
      });
    }
    
    return newInstallments;
  };

  const handleInstallmentCountChange = (count: string) => {
    const numCount = parseInt(count);
    setFormData({ ...formData, installmentCount: count });
    
    if (numCount > 0 && formData.startDate) {
      const newInstallments = generateInstallments(formData.startDate, numCount);
      setInstallments(newInstallments);
    } else {
      setInstallments([]);
    }
  };

  const handleStartDateChange = (date: string) => {
    setFormData({ ...formData, startDate: date });
    
    const count = parseInt(formData.installmentCount);
    if (count > 0 && date) {
      const newInstallments = generateInstallments(date, count);
      setInstallments(newInstallments);
    }
  };

  const updateInstallmentDate = (index: number, date: string) => {
    const newInstallments = [...installments];
    newInstallments[index] = { ...newInstallments[index], dueDate: date };
    setInstallments(newInstallments);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setError('');

    // Auto-upload the file
    const formDataFile = new FormData();
    formDataFile.append('file', file);
    formDataFile.append('category', 'LOAN_CONTRACT');

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
    if (!formData.lender || !formData.loanAmount || !formData.interestRate || 
        !formData.startDate || !formData.endDate || !formData.monthlyPayment || !formData.installmentCount) {
      setError('请填写所有必填字段');
      return;
    }

    const count = parseInt(formData.installmentCount);
    if (count < 1 || installments.length !== count) {
      setError('请正确设置分期次数和还款日期');
      return;
    }

    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/loans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          installmentCount: count,
          installments: installments,
          attachmentId: uploadedAttachmentId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '创建失败');
      }

      setSuccess('贷款记录创建成功');
      resetForm();
      await fetchLoans();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败，请重试');
    }
  };

  const handleUpdate = async (loanId: string) => {
    if (!formData.lender || !formData.loanAmount || !formData.interestRate || 
        !formData.startDate || !formData.endDate || !formData.monthlyPayment || !formData.installmentCount) {
      setError('请填写所有必填字段');
      return;
    }

    const count = parseInt(formData.installmentCount);
    if (count < 1 || installments.length !== count) {
      setError('请正确设置分期次数和还款日期');
      return;
    }

    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/loans/${loanId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          installmentCount: count,
          installments: installments,
          ...(uploadedAttachmentId && { newAttachmentId: uploadedAttachmentId }),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '更新失败');
      }

      setSuccess('贷款记录更新成功');
      resetForm();
      await fetchLoans();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败，请重试');
    }
  };

  const handleDelete = async (loanId: string, lender: string) => {
    if (!confirm(`确定要删除贷款记录「${lender}」吗？`)) {
      return;
    }

    try {
      const response = await fetch(`/api/vehicles/${vehicleId}/loans/${loanId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '删除失败');
      }

      setSuccess('删除成功');
      await fetchLoans();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败，请重试');
    }
  };

  const getDaysToEnd = (endDate: string) => {
    const now = new Date();
    const end = new Date(endDate);
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const isInstallmentOverdue = (dueDate: string, paidAt: string | null) => {
    if (paidAt) return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return due < now;
  };

  const getStatusBadge = (endDate: string) => {
    const days = getDaysToEnd(endDate);
    
    if (days < 0) {
      return <span className="badge bg-green-100 text-green-700">已结清</span>;
    } else if (days <= 30) {
      return <span className="badge bg-yellow-100 text-yellow-700">即将到期 ({days} 天)</span>;
    } else {
      return <span className="badge bg-blue-100 text-blue-700">还款中</span>;
    }
  };

  const startEdit = (loan: Loan) => {
    setEditingLoanId(loan.id);
    setFormData({
      lender: loan.lender,
      loanAmount: loan.loanAmount,
      interestRate: loan.interestRate,
      startDate: loan.startDate.split('T')[0],
      endDate: loan.endDate.split('T')[0],
      monthlyPayment: loan.monthlyPayment,
      installmentCount: loan.installmentCount.toString(),
      remark: loan.remark || '',
    });
    setInstallments(loan.installments.map(inst => ({
      dueDate: inst.dueDate.split('T')[0],
      paidAt: inst.paidAt ? inst.paidAt.split('T')[0] : undefined,
    })));
  };

  if (loading) {
    return null; // Don't show anything while loading
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center">
          <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          贷款台账
        </h2>
        {!showCreateForm && !editingLoanId && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn btn-primary text-sm"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新增贷款
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
            <h3 className="text-sm font-semibold text-gray-900">新增贷款记录</h3>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">贷款机构 *</label>
              <input
                type="text"
                value={formData.lender}
                onChange={(e) => setFormData({ ...formData, lender: e.target.value })}
                className="input-field text-sm"
                placeholder="如：工商银行、融资租赁公司等"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">贷款金额 (元) *</label>
              <input
                type="number"
                step="0.01"
                value={formData.loanAmount}
                onChange={(e) => setFormData({ ...formData, loanAmount: e.target.value })}
                className="input-field text-sm"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">年化利率 (%) *</label>
              <input
                type="number"
                step="0.0001"
                value={formData.interestRate}
                onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                className="input-field text-sm"
                placeholder="如：5.5"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">月供金额 (元) *</label>
              <input
                type="number"
                step="0.01"
                value={formData.monthlyPayment}
                onChange={(e) => setFormData({ ...formData, monthlyPayment: e.target.value })}
                className="input-field text-sm"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">贷款起始日 *</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">贷款到期日 *</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">分期次数 *</label>
              <input
                type="number"
                min="1"
                value={formData.installmentCount}
                onChange={(e) => handleInstallmentCountChange(e.target.value)}
                className="input-field text-sm"
                placeholder="如：24"
              />
            </div>
            {installments.length > 0 && (
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1.5">每期还款时间 *</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 bg-white rounded border border-gray-200">
                  {installments.map((inst, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <label className="text-xs text-gray-600 whitespace-nowrap">第{index + 1}期</label>
                      <input
                        type="date"
                        value={inst.dueDate}
                        onChange={(e) => updateInstallmentDate(index, e.target.value)}
                        className="input-field text-xs flex-1"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">贷款合同照片 {uploading && <span className="text-blue-600">(上传中...)</span>}</label>
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
              className="btn btn-primary text-sm"
            >
              创建贷款记录
            </button>
          </div>
        </div>
      )}

      {loans.length === 0 && !showCreateForm ? (
        <div className="text-center py-12 text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm">暂无贷款记录</p>
          <p className="text-xs text-gray-400 mt-1">车辆无贷款或已结清</p>
        </div>
      ) : (
        <div className="space-y-4">
          {loans.map((loan) => {
            const isEditing = editingLoanId === loan.id;
            
            return (
              <div key={loan.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                {!isEditing ? (
                  <>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-base font-semibold text-gray-900">{loan.lender}</h3>
                          {getStatusBadge(loan.endDate)}
                        </div>
                        <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <dt className="text-xs text-gray-500 mb-0.5">贷款金额</dt>
                            <dd className="font-semibold text-gray-900">¥{Number(loan.loanAmount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-gray-500 mb-0.5">年化利率</dt>
                            <dd className="text-gray-900">{Number(loan.interestRate).toFixed(4)}%</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-gray-500 mb-0.5">月供</dt>
                            <dd className="text-gray-900 font-medium">¥{Number(loan.monthlyPayment).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-gray-500 mb-0.5">贷款期限</dt>
                            <dd className="text-gray-900 text-xs">
                              {new Date(loan.startDate).toLocaleDateString('zh-CN')} 至<br />
                              {new Date(loan.endDate).toLocaleDateString('zh-CN')}
                            </dd>
                          </div>
                        </dl>
                        {loan.remark && (
                          <p className="text-xs text-gray-600 mt-2 bg-gray-50 p-2 rounded">{loan.remark}</p>
                        )}
                        
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-semibold text-gray-700">还款计划（共 {loan.installmentCount} 期）</h4>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                            {loan.installments.map((inst) => (
                              <div 
                                key={inst.id} 
                                className={`text-xs p-2 rounded border ${
                                  inst.paidAt 
                                    ? 'bg-green-50 border-green-200 text-green-700' 
                                    : isInstallmentOverdue(inst.dueDate, inst.paidAt)
                                    ? 'bg-red-50 border-red-300 text-red-700 font-medium'
                                    : 'bg-gray-50 border-gray-200 text-gray-700'
                                }`}
                              >
                                <div className="font-medium mb-0.5">第 {inst.periodNumber} 期</div>
                                <div className="text-xs">
                                  {new Date(inst.dueDate).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                                </div>
                                {inst.paidAt ? (
                                  <div className="text-xs font-medium mt-0.5 text-green-600">已还</div>
                                ) : isInstallmentOverdue(inst.dueDate, inst.paidAt) ? (
                                  <div className="text-xs font-medium mt-0.5">逾期</div>
                                ) : (
                                  <div className="text-xs mt-0.5 text-gray-500">未还</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => startEdit(loan)}
                          className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleDelete(loan.id, loan.lender)}
                          className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                        >
                          删除
                        </button>
                      </div>
                    </div>

                    {loan.attachments.length > 0 && (
                      <div className="mt-3">
                        <h4 className="text-xs font-medium text-gray-700 mb-2">贷款合同</h4>
                        <div className="flex flex-wrap gap-2">
                          {loan.attachments.map((att) => (
                            <a
                              key={att.id}
                              href={`/api/vehicles/${vehicleId}/attachments/${att.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block w-20 h-20 border-2 border-blue-500 rounded overflow-hidden hover:opacity-90 transition-opacity"
                              title="贷款合同"
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
                  </>
                ) : (
                  <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-900">编辑贷款记录</h4>
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
                        <label className="block text-xs font-medium text-gray-700 mb-1">贷款机构 *</label>
                        <input
                          type="text"
                          value={formData.lender}
                          onChange={(e) => setFormData({ ...formData, lender: e.target.value })}
                          className="input-field text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">贷款金额 (元) *</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.loanAmount}
                          onChange={(e) => setFormData({ ...formData, loanAmount: e.target.value })}
                          className="input-field text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">年化利率 (%) *</label>
                        <input
                          type="number"
                          step="0.0001"
                          value={formData.interestRate}
                          onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                          className="input-field text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">月供金额 (元) *</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.monthlyPayment}
                          onChange={(e) => setFormData({ ...formData, monthlyPayment: e.target.value })}
                          className="input-field text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">贷款起始日 *</label>
                        <input
                          type="date"
                          value={formData.startDate}
                          onChange={(e) => handleStartDateChange(e.target.value)}
                          className="input-field text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">贷款到期日 *</label>
                        <input
                          type="date"
                          value={formData.endDate}
                          onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                          className="input-field text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">分期次数 *</label>
                        <input
                          type="number"
                          min="1"
                          value={formData.installmentCount}
                          onChange={(e) => handleInstallmentCountChange(e.target.value)}
                          className="input-field text-sm"
                          placeholder="如：24"
                        />
                      </div>
                      {installments.length > 0 && (
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium text-gray-700 mb-1">每期还款时间 *</label>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 bg-white rounded border border-gray-200">
                            {installments.map((inst, index) => (
                              <div key={index} className="flex items-center space-x-2">
                                <label className="text-xs text-gray-600 whitespace-nowrap">第{index + 1}期</label>
                                <input
                                  type="date"
                                  value={inst.dueDate}
                                  onChange={(e) => updateInstallmentDate(index, e.target.value)}
                                  className="input-field text-xs flex-1"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">更新贷款合同照片 {uploading && <span className="text-blue-600">(上传中...)</span>}</label>
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
                        <label className="block text-xs font-medium text-gray-700 mb-1">备注</label>
                        <textarea
                          value={formData.remark}
                          onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                          rows={2}
                          className="input-field text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2 mt-3">
                      <button onClick={resetForm} className="btn btn-secondary text-sm">
                        取消
                      </button>
                      <button 
                        onClick={() => handleUpdate(loan.id)}
                        className="btn btn-primary text-sm"
                      >
                        保存更新
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
