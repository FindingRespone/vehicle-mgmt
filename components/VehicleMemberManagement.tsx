'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface UserOption {
  id: string;
  username: string;
  name: string;
  role: string;
}

interface MemberRow {
  id: string;
  userId: string;
  user: UserOption;
}

interface Props {
  vehicleId: string;
  initialOwner: { id: string; name: string; username?: string };
  initialMembers: MemberRow[];
}

export default function VehicleMemberManagement({
  vehicleId,
  initialOwner,
  initialMembers,
}: Props) {
  const router = useRouter();
  const [owner, setOwner] = useState(initialOwner);
  const [members, setMembers] = useState<MemberRow[]>(initialMembers);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState(initialOwner.id);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetch('/api/users')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]));
  }, []);

  const refresh = async () => {
    const res = await fetch(`/api/vehicles/${vehicleId}/members`);
    if (res.ok) {
      const data = await res.json();
      setOwner(data.owner);
      setSelectedOwnerId(data.owner.id);
      setMembers(data.members);
    }
    router.refresh();
  };

  const handleChangeOwner = async () => {
    if (!selectedOwnerId || selectedOwnerId === owner.id) {
      setError('请选择新的负责人');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/members`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerUserId: selectedOwnerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '更换负责人失败');
      setSuccess('负责人已更新');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '更换负责人失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedMemberId) {
      setError('请选择要添加的相关人');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedMemberId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '添加相关人失败');
      setSuccess('相关人已添加');
      setSelectedMemberId('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '添加相关人失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (member: MemberRow) => {
    if (!confirm(`确定移除相关人「${member.user.name}」吗？`)) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(
        `/api/vehicles/${vehicleId}/members?memberId=${member.id}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '移除失败');
      setSuccess('相关人已移除');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '移除失败');
    } finally {
      setLoading(false);
    }
  };

  const memberUserIds = new Set(members.map((m) => m.userId));
  const ownerCandidates = users;
  const memberCandidates = users.filter(
    (u) => u.id !== owner.id && !memberUserIds.has(u.id)
  );

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        成员管理
      </h2>

      {(error || success) && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            error
              ? 'bg-red-50 border border-red-200 text-red-600'
              : 'bg-green-50 border border-green-200 text-green-600'
          }`}
        >
          {error || success}
        </div>
      )}

      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">负责人</h3>
          <p className="text-sm text-gray-900 mb-3">
            当前：{owner.name}
            {owner.username ? (
              <span className="text-gray-500 ml-2">(@{owner.username})</span>
            ) : null}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={selectedOwnerId}
              onChange={(e) => setSelectedOwnerId(e.target.value)}
              className="input-field flex-1"
              disabled={loading}
            >
              {ownerCandidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.username})
                </option>
              ))}
            </select>
            <button
              onClick={handleChangeOwner}
              disabled={loading || selectedOwnerId === owner.id}
              className="btn btn-primary disabled:opacity-50"
            >
              更换负责人
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">相关人</h3>
          {members.length === 0 ? (
            <p className="text-sm text-gray-500 mb-3">暂无相关人</p>
          ) : (
            <ul className="space-y-2 mb-3">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center">
                    <div className="w-7 h-7 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-medium text-xs mr-2">
                      {m.user.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{m.user.name}</p>
                      <p className="text-xs text-gray-500">{m.user.username}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveMember(m)}
                    disabled={loading}
                    className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded"
                  >
                    移除
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="input-field flex-1"
              disabled={loading}
            >
              <option value="">选择用户添加为相关人</option>
              {memberCandidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.username})
                </option>
              ))}
            </select>
            <button
              onClick={handleAddMember}
              disabled={loading || !selectedMemberId}
              className="btn btn-primary disabled:opacity-50"
            >
              添加相关人
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
