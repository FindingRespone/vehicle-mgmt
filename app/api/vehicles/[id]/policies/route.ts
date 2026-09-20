import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageVehicles, isAdminOrAbove } from '@/lib/roles';
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

    const policies = await prisma.insurancePolicy.findMany({
      where: {
        vehicleId: id,
      },
      include: {
        attachments: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
      orderBy: {
        endDate: 'desc',
      },
    });

    return NextResponse.json(policies);
  } catch (error) {
    console.error('Get policies error:', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // Only ADMIN and SUPER_ADMIN can create policies
    if (!canManageVehicles(session.user.role)) {
      return NextResponse.json({ error: '只有管理员可以创建保单' }, { status: 403 });
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
    });

    if (!vehicle) {
      return NextResponse.json({ error: '车辆不存在' }, { status: 404 });
    }

    const data = await request.json();

    // Validate required fields
    if (!data.policyNo || !data.insuranceCompany || !data.insuranceType || !data.startDate || !data.endDate || !data.premium) {
      return NextResponse.json({ error: '请填写所有必填字段' }, { status: 400 });
    }

    // Validate that attachmentId is provided (must have policy photo)
    if (!data.attachmentId) {
      return NextResponse.json({ error: '创建保单必须上传保单照片' }, { status: 400 });
    }

    // Verify attachment exists and is INSURANCE category
    const attachment = await prisma.attachment.findUnique({
      where: { id: data.attachmentId },
    });

    if (!attachment || attachment.category !== 'INSURANCE' || attachment.deletedAt !== null) {
      return NextResponse.json({ error: '无效的保单照片' }, { status: 400 });
    }

    const policy = await prisma.insurancePolicy.create({
      data: {
        vehicleId: id,
        policyNo: data.policyNo,
        insuranceCompany: data.insuranceCompany,
        insuranceType: data.insuranceType,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        premium: data.premium,
        remark: data.remark || null,
      },
      include: {
        attachments: true,
      },
    });

    // Link the attachment to this policy
    await prisma.attachment.update({
      where: { id: data.attachmentId },
      data: {
        insurancePolicyId: policy.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        vehicleId: id,
        action: 'CREATE_INSURANCE_POLICY',
        entityType: 'InsurancePolicy',
        entityId: policy.id,
        changes: data,
      },
    });

    // Fetch the policy with attached photo
    const policyWithAttachment = await prisma.insurancePolicy.findUnique({
      where: { id: policy.id },
      include: {
        attachments: {
          where: {
            deletedAt: null,
          },
        },
      },
    });

    return NextResponse.json(policyWithAttachment);
  } catch (error) {
    console.error('Create policy error:', error);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
