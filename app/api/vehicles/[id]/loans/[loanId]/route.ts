import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isSuperAdmin } from '@/lib/roles';
import { NextResponse } from 'next/server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; loanId: string }> }
) {
  try {
    const session = await auth();
    const { id, loanId } = await params;

    if (!session) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // Only SUPER_ADMIN can update loans
    if (!isSuperAdmin(session.user.role)) {
      return NextResponse.json({ error: '只有超级管理员可以更新贷款记录' }, { status: 403 });
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
    });

    if (!vehicle) {
      return NextResponse.json({ error: '车辆不存在' }, { status: 404 });
    }

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
    });

    if (!loan) {
      return NextResponse.json({ error: '贷款记录不存在' }, { status: 404 });
    }

    if (loan.vehicleId !== id) {
      return NextResponse.json({ error: '贷款记录与车辆不匹配' }, { status: 400 });
    }

    const data = await request.json();

    // Build update data object
    const updateData: any = {};

    if (data.lender !== undefined) updateData.lender = data.lender;
    if (data.loanAmount !== undefined) updateData.loanAmount = data.loanAmount;
    if (data.interestRate !== undefined) updateData.interestRate = data.interestRate;
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);
    if (data.monthlyPayment !== undefined) updateData.monthlyPayment = data.monthlyPayment;
    if (data.remark !== undefined) updateData.remark = data.remark || null;

    // If new attachment is provided, link it
    if (data.newAttachmentId) {
      const attachment = await prisma.attachment.findUnique({
        where: { id: data.newAttachmentId },
      });

      if (!attachment || attachment.category !== 'LOAN_CONTRACT' || attachment.deletedAt !== null) {
        return NextResponse.json({ error: '无效的贷款合同附件' }, { status: 400 });
      }

      await prisma.attachment.update({
        where: { id: data.newAttachmentId },
        data: {
          loanId: loanId,
        },
      });
    }

    const updatedLoan = await prisma.loan.update({
      where: { id: loanId },
      data: updateData,
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
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        vehicleId: id,
        action: 'UPDATE_LOAN',
        entityType: 'Loan',
        entityId: loanId,
        changes: data,
      },
    });

    return NextResponse.json(updatedLoan);
  } catch (error) {
    console.error('Update loan error:', error);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; loanId: string }> }
) {
  try {
    const session = await auth();
    const { id, loanId } = await params;

    if (!session) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // Only SUPER_ADMIN can delete loans
    if (!isSuperAdmin(session.user.role)) {
      return NextResponse.json({ error: '只有超级管理员可以删除贷款记录' }, { status: 403 });
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
    });

    if (!vehicle) {
      return NextResponse.json({ error: '车辆不存在' }, { status: 404 });
    }

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
    });

    if (!loan) {
      return NextResponse.json({ error: '贷款记录不存在' }, { status: 404 });
    }

    if (loan.vehicleId !== id) {
      return NextResponse.json({ error: '贷款记录与车辆不匹配' }, { status: 400 });
    }

    await prisma.loan.delete({
      where: { id: loanId },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        vehicleId: id,
        action: 'DELETE_LOAN',
        entityType: 'Loan',
        entityId: loanId,
        changes: {
          lender: loan.lender,
          loanAmount: loan.loanAmount,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete loan error:', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
