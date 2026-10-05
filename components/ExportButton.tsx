'use client';

import { useState } from 'react';

export default function ExportButton() {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!confirm('确认导出当前权限范围内的车队数据？导出内容仅包含你已能查看的字段，不含定位或费用流水。')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/export');
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || '导出失败');
      }

      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || 'fleet-export.csv';

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(error instanceof Error ? error.message : '导出失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading}
      className="btn btn-secondary"
    >
      {loading ? '导出中...' : '导出 CSV'}
    </button>
  );
}
