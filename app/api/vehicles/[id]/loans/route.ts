import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isSuperAdmin } from '@/lib/roles';
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

    // Only SUPER_ADMIN can access loan data
    if (!isSuperAdmin(session.user.role)) {
      return NextResponse.json({ error: '只有超级管理员可以查看贷款信息' }, { status: 403 });
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
    });

    if (!vehicle) {
      return NextResponse.json({ error: '车辆不存在' }, { status: 404 });
    }

    const loans = await prisma.loan.findMany({
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
        startDate: 'desc',
      },
    });

    return NextResponse.json(loans);
  } catch (error) {
    console.error('Get loans error:', error);
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

    // Only SUPER_ADMIN can create loans
    if (!isSuperAdmin(session.user.role)) {
      return NextResponse.json({ error: '只有超级管理员可以创建贷款记录' }, { status: 403 });
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
    });

    if (!vehicle) {
      return NextResponse.json({ error: '车辆不存在' }, { status: 404 });
    }

    const data = await request.json();

    // Validate required fields
    if (!data.lender || !data.loanAmount || !data.interestRate || !data.startDate || !data.endDate || !data.monthlyPayment) {
      return NextResponse.json({ error: '请填写所有必填字段' }, { status: 400 });
    }

    // Validate attachmentId if provided
    if (data.attachmentId) {
      const attachment = await prisma.attachment.findUnique({
        where: { id: data.attachmentId },
      });

      if (!attachment || attachment.category !== 'LOAN_CONTRACT' || attachment.deletedAt !== null) {
        return NextResponse.json({ error: '无效的贷款合同附件' }, { status: 400 });
      }
    }

    const loan = await prisma.loan.create({
      data: {
        vehicleId: id,
        lender: data.lender,
        loanAmount: data.loanAmount,
        interestRate: data.interestRate,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        monthlyPayment: data.monthlyPayment,
        remark: data.remark || null,
      },
      include: {
        attachments: true,
      },
    });

    // Link the attachment to this loan if provided
    if (data.attachmentId) {
      await prisma.attachment.update({
        where: { id: data.attachmentId },
        data: {
          loanId: loan.id,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        vehicleId: id,
        action: 'CREATE_LOAN',
        entityType: 'Loan',
        entityId: loan.id,
        changes: data,
      },
    });

    // Fetch the loan with attachment
    const loanWithAttachment = await prisma.loan.findUnique({
      where: { id: loan.id },
      include: {
        attachments: {
          where: {
            deletedAt: null,
          },
        },
      },
    });

    return NextResponse.json(loanWithAttachment);
  } catch (error) {
    console.error('Create loan error:', error);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
