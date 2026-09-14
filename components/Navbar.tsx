'use client';

import { signOut } from 'next-auth/react';
import Link from 'next/link';

interface NavbarProps {
  user: {
    name?: string | null;
    role: string;
  };
}

export default function Navbar({ user }: NavbarProps) {
  const roleLabels = {
    ADMIN: '管理员',
    VEHICLE_MEMBER: '车辆管理员',
    FINANCE_READONLY: '财务只读',
  };

  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link
              href="/vehicles"
              className="flex items-center px-3 text-gray-900 font-semibold text-lg"
            >
              众投物流车辆管理系统
            </Link>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                href="/vehicles"
                className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 border-b-2 border-blue-500"
              >
                车辆管理
              </Link>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-700">
              {user.name} ({roleLabels[user.role as keyof typeof roleLabels]})
            </span>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-sm text-gray-700 hover:text-gray-900"
            >
              退出登录
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
