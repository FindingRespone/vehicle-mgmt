import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageMembers } from '@/lib/roles';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    if (!canManageMembers(session.user.role)) {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
      },
      orderBy: [
        { role: 'asc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}
