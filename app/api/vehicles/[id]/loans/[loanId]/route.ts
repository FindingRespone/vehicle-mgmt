import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isSuperAdmin } from '@/lib/roles';
import { invalidateOldReminders } from '@/lib/reminders';
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

    // Check if critical terms are being changed
    const criticalTermsChanged = (
      data.loanAmount !== undefined ||
      data.interestRate !== undefined ||
      data.monthlyPayment !== undefined ||
      data.startDate !== undefined ||
      data.endDate !== undefined ||
      data.installmentCount !== undefined ||
      data.installments !== undefined ||
      data.lender !== undefined
    );

    // If critical terms are changed, require new attachment
    if (criticalTermsChanged && !data.newAttachmentId) {
      return NextResponse.json({ error: '变更贷款关键条款必须上传新的合同影像' }, { status: 400 });
    }

    // Build update data object
    const updateData: any = {};

    if (data.lender !== undefined) updateData.lender = data.lender;
    if (data.loanAmount !== undefined) updateData.loanAmount = data.loanAmount;
    if (data.interestRate !== undefined) updateData.interestRate = data.interestRate;
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);
    if (data.monthlyPayment !== undefined) updateData.monthlyPayment = data.monthlyPayment;
    if (data.remark !== undefined) updateData.remark = data.remark || null;
    
    // Handle installmentCount update
    if (data.installmentCount !== undefined) {
      if (data.installmentCount < 1 || !Number.isInteger(data.installmentCount)) {
        return NextResponse.json({ error: '分期次数必须是正整数' }, { status: 400 });
      }
      updateData.installmentCount = data.installmentCount;
    }

    // Handle installments update
    if (data.installments !== undefined) {
      if (!Array.isArray(data.installments)) {
        return NextResponse.json({ error: '还款日期格式错误' }, { status: 400 });
      }
      
      const installmentCount = data.installmentCount !== undefined ? data.installmentCount : loan.installmentCount;
      if (data.installments.length !== installmentCount) {
        return NextResponse.json({ error: '还款日期数量必须与分期次数一致' }, { status: 400 });
      }
    }

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

    // Update installments if provided
    if (data.installments !== undefined) {
      // Get old installments to invalidate their reminders
      const oldInstallments = await prisma.loanInstallment.findMany({
        where: { loanId: loanId },
        select: { id: true },
      });

      // Invalidate old reminders for each installment
      for (const inst of oldInstallments) {
        await invalidateOldReminders({
          vehicleId: id,
          sourceType: 'LoanInstallment',
          sourceId: inst.id,
        });
      }

      // Delete existing installments and create new ones
      await prisma.loanInstallment.deleteMany({
        where: { loanId: loanId },
      });
      
      await prisma.loanInstallment.createMany({
        data: data.installments.map((inst: any, index: number) => ({
          loanId: loanId,
          periodNumber: index + 1,
          dueDate: new Date(inst.dueDate),
          paidAt: inst.paidAt ? new Date(inst.paidAt) : null,
        })),
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
        installments: {
          orderBy: {
            periodNumber: 'asc',
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
