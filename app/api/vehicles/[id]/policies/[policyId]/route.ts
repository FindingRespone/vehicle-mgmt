import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageVehicles, isAdminOrAbove } from '@/lib/roles';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; policyId: string }> }
) {
  try {
    const session = await auth();
    const { id, policyId } = await params;

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

    // Check access: admin/super_admin or owner or member
    if (!isAdminOrAbove(session.user.role)) {
      const isMember = vehicle.members.some((m) => m.userId === session.user.id);
      if (vehicle.ownerUserId !== session.user.id && !isMember) {
        return NextResponse.json({ error: '无权限' }, { status: 403 });
      }
    }

    const policy = await prisma.insurancePolicy.findUnique({
      where: { id: policyId },
      include: {
        attachments: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!policy || policy.vehicleId !== id) {
      return NextResponse.json({ error: '保单不存在' }, { status: 404 });
    }

    return NextResponse.json(policy);
  } catch (error) {
    console.error('Get policy error:', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; policyId: string }> }
) {
  try {
    const session = await auth();
    const { id, policyId } = await params;

    if (!session) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // Only ADMIN and SUPER_ADMIN can update policies
    if (!canManageVehicles(session.user.role)) {
      return NextResponse.json({ error: '只有管理员可以更新保单' }, { status: 403 });
    }

    const policy = await prisma.insurancePolicy.findUnique({
      where: { id: policyId },
      include: {
        attachments: {
          where: {
            deletedAt: null,
            supersededAt: null,
          },
        },
      },
    });

    if (!policy || policy.vehicleId !== id) {
      return NextResponse.json({ error: '保单不存在' }, { status: 404 });
    }

    const data = await request.json();

    // Check if this is a renewal (endDate is being updated)
    const isRenewal = data.endDate && new Date(data.endDate).getTime() !== new Date(policy.endDate).getTime();

    // If renewing, must provide new policy photo
    if (isRenewal) {
      if (!data.newAttachmentId) {
        return NextResponse.json({ error: '续保请上传新保单照片' }, { status: 400 });
      }

      // Verify the new attachment exists and is valid
      const newAttachment = await prisma.attachment.findUnique({
        where: { id: data.newAttachmentId },
      });

      if (!newAttachment || newAttachment.category !== 'INSURANCE' || newAttachment.deletedAt !== null) {
        return NextResponse.json({ error: '无效的保单照片' }, { status: 400 });
      }

      // Mark all current active attachments as superseded
      const now = new Date();
      await prisma.attachment.updateMany({
        where: {
          insurancePolicyId: policyId,
          deletedAt: null,
          supersededAt: null,
        },
        data: {
          supersededAt: now,
        },
      });

      // Link the new attachment to this policy
      await prisma.attachment.update({
        where: { id: data.newAttachmentId },
        data: {
          insurancePolicyId: policyId,
        },
      });
    }

    // Update policy fields
    const updateData: any = {};
    if (data.policyNo) updateData.policyNo = data.policyNo;
    if (data.insuranceCompany) updateData.insuranceCompany = data.insuranceCompany;
    if (data.insuranceType) updateData.insuranceType = data.insuranceType;
    if (data.startDate) updateData.startDate = new Date(data.startDate);
    if (data.endDate) updateData.endDate = new Date(data.endDate);
    if (data.premium !== undefined) updateData.premium = data.premium;
    if (data.remark !== undefined) updateData.remark = data.remark || null;

    const updatedPolicy = await prisma.insurancePolicy.update({
      where: { id: policyId },
      data: updateData,
      include: {
        attachments: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        vehicleId: id,
        action: isRenewal ? 'RENEW_INSURANCE_POLICY' : 'UPDATE_INSURANCE_POLICY',
        entityType: 'InsurancePolicy',
        entityId: policyId,
        changes: data,
      },
    });

    return NextResponse.json(updatedPolicy);
  } catch (error) {
    console.error('Update policy error:', error);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; policyId: string }> }
) {
  try {
    const session = await auth();
    const { id, policyId } = await params;

    if (!session) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // Only ADMIN and SUPER_ADMIN can delete policies
    if (!canManageVehicles(session.user.role)) {
      return NextResponse.json({ error: '只有管理员可以删除保单' }, { status: 403 });
    }

    const policy = await prisma.insurancePolicy.findUnique({
      where: { id: policyId },
    });

    if (!policy || policy.vehicleId !== id) {
      return NextResponse.json({ error: '保单不存在' }, { status: 404 });
    }

    await prisma.insurancePolicy.delete({
      where: { id: policyId },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        vehicleId: id,
        action: 'DELETE_INSURANCE_POLICY',
        entityType: 'InsurancePolicy',
        entityId: policyId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete policy error:', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
