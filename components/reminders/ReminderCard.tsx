'use client';

import { useState } from 'react';
import Link from 'next/link';
import { confirmReminder } from './actions';

interface ReminderCardProps {
  reminder: {
    id: string;
    vehicleId: string;
    sourceType: string;
    sourceId: string | null;
    title: string;
    description: string | null;
    dueDate: Date;
    offsetDays: number;
    status: string;
    vehicle: {
      id: string;
      plateNo: string;
      brandModel: string | null;
    };
  };
  userRole: string;
}

export function ReminderCard({ reminder, userRole }: ReminderCardProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  const handleConfirm = async () => {
    if (!showWarning) {
      setShowWarning(true);
      return;
    }

    setIsConfirming(true);
    try {
      const result = await confirmReminder(reminder.id);
      if (result.success) {
        window.location.reload();
      } else {
        alert(result.error || '确认失败');
      }
    } catch (error) {
      alert('操作失败，请重试');
    } finally {
      setIsConfirming(false);
    }
  };

  const getSourceTypeLabel = (sourceType: string) => {
    switch (sourceType) {
      case 'InsurancePolicy':
        return '保险';
      case 'AnnualInspection':
        return '年检';
      case 'LoanInstallment':
        return '贷款';
      default:
        return sourceType;
    }
  };

  const getOffsetLabel = (offsetDays: number) => {
    if (offsetDays === 0) {
      return '已过期';
    } else if (offsetDays === 7) {
      return '7天提醒';
    } else if (offsetDays === 15) {
      return '15天提醒';
    } else if (offsetDays === 30) {
      return '30天提醒';
    } else {
      return `${offsetDays}天提醒`;
    }
  };

  const getStatusColor = (offsetDays: number) => {
    if (offsetDays === 0) {
      return 'text-red-700 bg-red-50 border-red-200';
    } else if (offsetDays === 7) {
      return 'text-orange-700 bg-orange-50 border-orange-200';
    } else if (offsetDays === 15) {
      return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    } else {
      return 'text-blue-700 bg-blue-50 border-blue-200';
    }
  };

  // Don't show loan amount to non-super-admin
  const shouldHideDetails = reminder.sourceType === 'LoanInstallment' && userRole !== 'SUPER_ADMIN';

  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(reminder.offsetDays)}`}>
              {getOffsetLabel(reminder.offsetDays)}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
              {getSourceTypeLabel(reminder.sourceType)}
            </span>
            <Link
              href={`/vehicles/${reminder.vehicle.id}`}
              className="text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              {reminder.vehicle.plateNo}
            </Link>
          </div>
          
          <h3 className="text-sm font-medium text-gray-900 mb-1">
            {reminder.title}
          </h3>
          
          {reminder.description && !shouldHideDetails && (
            <p className="text-sm text-gray-600 mb-2">
              {reminder.description}
            </p>
          )}

          {shouldHideDetails && (
            <p className="text-sm text-gray-500 mb-2">
              贷款还款提醒（详情仅超级管理员可见）
            </p>
          )}

          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>
              到期日: {new Date(reminder.dueDate).toLocaleDateString('zh-CN')}
            </span>
            {reminder.vehicle.brandModel && (
              <span>{reminder.vehicle.brandModel}</span>
            )}
          </div>
        </div>

        <div className="ml-4 flex-shrink-0">
          {!showWarning ? (
            <button
              onClick={handleConfirm}
              disabled={isConfirming}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              已处理
            </button>
          ) : (
            <div className="space-y-2">
              <div className="text-xs text-orange-600 mb-2 max-w-xs">
                ⚠️ 确认前请确保已在车辆管理中更新了到期日，否则下次批跑仍会生成提醒
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleConfirm}
                  disabled={isConfirming}
                  className="inline-flex items-center px-3 py-2 border border-blue-600 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isConfirming ? '处理中...' : '确认已处理'}
                </button>
                <button
                  onClick={() => setShowWarning(false)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
