import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
              },
            },
          },
        },
      },
    });

    if (!vehicle) {
      return NextResponse.json({ error: '车辆不存在' }, { status: 404 });
    }

    if (session.user.role !== 'ADMIN') {
      const isMember = vehicle.members.some(
        (m) => m.userId === session.user.id
      );
      if (vehicle.ownerUserId !== session.user.id && !isMember) {
        return NextResponse.json({ error: '无权限' }, { status: 403 });
      }
    }

    return NextResponse.json(vehicle);
  } catch (error) {
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    const data = await request.json();

    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: {
        brandModel: data.brandModel,
        powerType: data.powerType || null,
        vehicleClass: data.vehicleClass || null,
        status: data.status,
        availability: data.availability,
        annualInspectionDueAt: data.annualInspectionDueAt
          ? new Date(data.annualInspectionDueAt)
          : null,
        remark: data.remark || null,
        vin: data.vin || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        vehicleId: vehicle.id,
        action: 'UPDATE',
        entityType: 'Vehicle',
        entityId: vehicle.id,
        changes: data,
      },
    });

    return NextResponse.json(vehicle);
  } catch (error) {
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    await prisma.vehicle.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        vehicleId: id,
        action: 'DELETE',
        entityType: 'Vehicle',
        entityId: id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
