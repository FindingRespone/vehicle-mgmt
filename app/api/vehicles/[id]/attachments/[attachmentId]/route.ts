import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const session = await auth();
    const { id, attachmentId } = await params;

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

    if (session.user.role !== 'ADMIN') {
      const isMember = vehicle.members.some((m) => m.userId === session.user.id);
      if (vehicle.ownerUserId !== session.user.id && !isMember) {
        return NextResponse.json({ error: '无权限' }, { status: 403 });
      }
    }

    const attachment = await prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        vehicleId: id,
        deletedAt: null,
      },
    });

    if (!attachment) {
      return NextResponse.json({ error: '附件不存在' }, { status: 404 });
    }

    if (attachment.category === 'LOAN_CONTRACT' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '只有管理员可以查看贷款合同' }, { status: 403 });
    }

    const filepath = join(/*turbopackIgnore: true*/ process.cwd(), attachment.filepath);
    const fileBuffer = await readFile(filepath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(attachment.originalFilename)}"`,
        'Content-Length': attachment.filesize.toString(),
      },
    });
  } catch (error) {
    console.error('Get attachment file error:', error);
    return NextResponse.json({ error: '获取文件失败' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const session = await auth();
    const { id, attachmentId } = await params;

    if (!session) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '只有管理员可以删除附件' }, { status: 403 });
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
    });

    if (!vehicle) {
      return NextResponse.json({ error: '车辆不存在' }, { status: 404 });
    }

    const attachment = await prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        vehicleId: id,
        deletedAt: null,
      },
    });

    if (!attachment) {
      return NextResponse.json({ error: '附件不存在' }, { status: 404 });
    }

    await prisma.attachment.update({
      where: { id: attachmentId },
      data: {
        deletedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        vehicleId: id,
        action: 'DELETE_ATTACHMENT',
        entityType: 'Attachment',
        entityId: attachmentId,
        changes: {
          category: attachment.category,
          filename: attachment.originalFilename,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete attachment error:', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
