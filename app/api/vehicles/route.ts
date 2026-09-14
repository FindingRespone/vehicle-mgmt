import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    const data = await request.json();

    const vehicle = await prisma.vehicle.create({
      data: {
        plateNo: data.plateNo,
        vin: data.vin || null,
        brandModel: data.brandModel,
        status: data.status || 'IN_USE',
        availability: data.availability || 'AVAILABLE',
        ownerUserId: session.user!.id,
        annualInspectionDueAt: data.annualInspectionDueAt
          ? new Date(data.annualInspectionDueAt)
          : null,
        remark: data.remark || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user!.id,
        vehicleId: vehicle.id,
        action: 'CREATE',
        entityType: 'Vehicle',
        entityId: vehicle.id,
        changes: data,
      },
    });

    return NextResponse.json(vehicle);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: '车牌号已存在' }, { status: 400 });
    }
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    let vehicles;

    if (session.user!.role === 'ADMIN') {
      vehicles = await prisma.vehicle.findMany({
        include: {
          owner: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } else {
      vehicles = await prisma.vehicle.findMany({
        where: {
          OR: [
            { ownerUserId: session.user!.id },
            {
              members: {
                some: {
                  userId: session.user!.id,
                },
              },
            },
          ],
        },
        include: {
          owner: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    }

    return NextResponse.json(vehicles);
  } catch (error) {
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}
