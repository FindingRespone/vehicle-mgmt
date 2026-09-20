import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageMembers } from '@/lib/roles';
import { NextResponse } from 'next/server';

async function requireMemberManager() {
  const session = await auth();
  if (!session) {
    return { error: NextResponse.json({ error: '未登录' }, { status: 401 }) };
  }
  if (!canManageMembers(session.user.role)) {
    return { error: NextResponse.json({ error: '无权限' }, { status: 403 }) };
  }
  return { session };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireMemberManager();
    if ('error' in authResult && authResult.error) return authResult.error;

    const { id } = await params;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, name: true, username: true, role: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, username: true, role: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!vehicle) {
      return NextResponse.json({ error: '车辆不存在' }, { status: 404 });
    }

    return NextResponse.json({
      owner: vehicle.owner,
      members: vehicle.members,
    });
  } catch (error) {
    console.error('Get members error:', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireMemberManager();
    if ('error' in authResult && authResult.error) return authResult.error;
    const session = authResult.session!;

    const { id } = await params;
    const data = await request.json();
    const userId = data.userId as string;

    if (!userId) {
      return NextResponse.json({ error: '缺少用户ID' }, { status: 400 });
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) {
      return NextResponse.json({ error: '车辆不存在' }, { status: 404 });
    }

    if (vehicle.ownerUserId === userId) {
      return NextResponse.json({ error: '负责人已是车辆负责人，无需添加为相关人' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    const member = await prisma.vehicleMember.create({
      data: {
        vehicleId: id,
        userId,
      },
      include: {
        user: {
          select: { id: true, name: true, username: true, role: true },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        vehicleId: id,
        action: 'ADD_MEMBER',
        entityType: 'VehicleMember',
        entityId: member.id,
        changes: { userId },
      },
    });

    return NextResponse.json(member);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: '该用户已是相关人' }, { status: 400 });
    }
    console.error('Add member error:', error);
    return NextResponse.json({ error: '添加失败' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireMemberManager();
    if ('error' in authResult && authResult.error) return authResult.error;
    const session = authResult.session!;

    const { id } = await params;
    const data = await request.json();
    const ownerUserId = data.ownerUserId as string;

    if (!ownerUserId) {
      return NextResponse.json({ error: '缺少负责人用户ID' }, { status: 400 });
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) {
      return NextResponse.json({ error: '车辆不存在' }, { status: 404 });
    }

    const newOwner = await prisma.user.findUnique({ where: { id: ownerUserId } });
    if (!newOwner) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Remove new owner from members if present
      await tx.vehicleMember.deleteMany({
        where: { vehicleId: id, userId: ownerUserId },
      });

      return tx.vehicle.update({
        where: { id },
        data: { ownerUserId },
        include: {
          owner: {
            select: { id: true, name: true, username: true, role: true },
          },
        },
      });
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        vehicleId: id,
        action: 'CHANGE_OWNER',
        entityType: 'Vehicle',
        entityId: id,
        changes: {
          previousOwnerUserId: vehicle.ownerUserId,
          ownerUserId,
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Change owner error:', error);
    return NextResponse.json({ error: '更新负责人失败' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireMemberManager();
    if ('error' in authResult && authResult.error) return authResult.error;
    const session = authResult.session!;

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const memberId = searchParams.get('memberId');

    if (!userId && !memberId) {
      return NextResponse.json({ error: '缺少 userId 或 memberId' }, { status: 400 });
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) {
      return NextResponse.json({ error: '车辆不存在' }, { status: 404 });
    }

    const where = memberId
      ? { id: memberId, vehicleId: id }
      : { vehicleId: id, userId: userId! };

    const existing = await prisma.vehicleMember.findFirst({ where });
    if (!existing) {
      return NextResponse.json({ error: '相关人不存在' }, { status: 404 });
    }

    await prisma.vehicleMember.delete({ where: { id: existing.id } });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        vehicleId: id,
        action: 'REMOVE_MEMBER',
        entityType: 'VehicleMember',
        entityId: existing.id,
        changes: { userId: existing.userId },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Remove member error:', error);
    return NextResponse.json({ error: '移除失败' }, { status: 500 });
  }
}
