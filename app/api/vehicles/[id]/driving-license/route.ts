import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseDrivingLicenseMeta, serializeDrivingLicenseMeta } from '@/lib/drivingLicense';
import { canManageVehicles, canViewAllVehicles } from '@/lib/roles';
import { NextResponse } from 'next/server';

async function loadFrontImages(vehicleId: string) {
  return prisma.attachment.findMany({
    where: {
      vehicleId,
      category: 'DRIVING_LICENSE',
      deletedAt: null,
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      category: true,
      filename: true,
      originalFilename: true,
      filesize: true,
      mimeType: true,
      uploadedBy: true,
      createdAt: true,
      supersededAt: true,
    },
  });
}

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
        members: {
          select: { userId: true },
        },
      },
    });

    if (!vehicle) {
      return NextResponse.json({ error: '车辆不存在' }, { status: 404 });
    }

    if (!canViewAllVehicles(session.user.role)) {
      const isMember = vehicle.members.some((m) => m.userId === session.user.id);
      if (vehicle.ownerUserId !== session.user.id && !isMember) {
        return NextResponse.json({ error: '无权限' }, { status: 403 });
      }
    }

    const frontImages = await loadFrontImages(id);

    return NextResponse.json({
      meta: parseDrivingLicenseMeta(vehicle.drivingLicenseMeta),
      frontImages,
    });
  } catch (error) {
    console.error('Get driving license error:', error);
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

    if (!session) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    if (!canManageVehicles(session.user.role)) {
      return NextResponse.json({ error: '只有管理员可以保存行驶证信息' }, { status: 403 });
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
    });

    if (!vehicle) {
      return NextResponse.json({ error: '车辆不存在' }, { status: 404 });
    }

    const data = await request.json();
    const meta = serializeDrivingLicenseMeta({
      licenseNo: data.licenseNo,
      vehicleType: data.vehicleType,
      ownerName: data.ownerName,
      useNature: data.useNature,
    });

    const existingFront = await prisma.attachment.findFirst({
      where: {
        vehicleId: id,
        category: 'DRIVING_LICENSE',
        deletedAt: null,
        supersededAt: null,
      },
    });

    if (data.attachmentId) {
      const attachment = await prisma.attachment.findFirst({
        where: {
          id: data.attachmentId,
          vehicleId: id,
          category: 'DRIVING_LICENSE',
          deletedAt: null,
        },
      });

      if (!attachment) {
        return NextResponse.json({ error: '无效的行驶证正面图片' }, { status: 400 });
      }

      await prisma.attachment.updateMany({
        where: {
          vehicleId: id,
          category: 'DRIVING_LICENSE',
          deletedAt: null,
          supersededAt: null,
          id: { not: attachment.id },
        },
        data: {
          supersededAt: new Date(),
        },
      });
    } else if (!existingFront) {
      return NextResponse.json({ error: '请上传行驶证正面图片' }, { status: 400 });
    }

    const updated = await prisma.vehicle.update({
      where: { id },
      data: {
        drivingLicenseMeta: meta,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        vehicleId: id,
        action: 'UPDATE_DRIVING_LICENSE',
        entityType: 'Vehicle',
        entityId: id,
        changes: {
          drivingLicenseMeta: meta,
          attachmentId: data.attachmentId || null,
        },
      },
    });

    const frontImages = await loadFrontImages(id);

    return NextResponse.json({
      meta: parseDrivingLicenseMeta(updated.drivingLicenseMeta),
      frontImages,
    });
  } catch (error) {
    console.error('Update driving license error:', error);
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}
