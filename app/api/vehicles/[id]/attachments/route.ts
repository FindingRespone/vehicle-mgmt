import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

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

    if (session.user.role !== 'ADMIN') {
      const isMember = vehicle.members.some((m) => m.userId === session.user.id);
      if (vehicle.ownerUserId !== session.user.id && !isMember) {
        return NextResponse.json({ error: '无权限' }, { status: 403 });
      }
    }

    const attachments = await prisma.attachment.findMany({
      where: {
        vehicleId: id,
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
      },
    });

    return NextResponse.json(attachments);
  } catch (error) {
    console.error('Get attachments error:', error);
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

    if (session.user.role === 'FINANCE_READONLY') {
      return NextResponse.json({ error: '无上传权限' }, { status: 403 });
    }

    if (session.user.role !== 'ADMIN') {
      const isMember = vehicle.members.some((m) => m.userId === session.user.id);
      if (vehicle.ownerUserId !== session.user.id && !isMember) {
        return NextResponse.json({ error: '无权限' }, { status: 403 });
      }
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const category = formData.get('category') as string;

    if (!file) {
      return NextResponse.json({ error: '未选择文件' }, { status: 400 });
    }

    if (!category) {
      return NextResponse.json({ error: '未选择类别' }, { status: 400 });
    }

    const validCategories = ['DRIVING_LICENSE', 'VEHICLE_PHOTO', 'INSURANCE', 'LOAN_CONTRACT', 'OTHER'];
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: '无效的类别' }, { status: 400 });
    }

    type AttachmentCategory = 'DRIVING_LICENSE' | 'VEHICLE_PHOTO' | 'INSURANCE' | 'LOAN_CONTRACT' | 'OTHER';
    const attachmentCategory = category as AttachmentCategory;

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: '文件大小不能超过10MB' }, { status: 400 });
    }

    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
    ];

    if (!allowedMimeTypes.includes(file.type)) {
      return NextResponse.json({ error: '只支持图片 (JPG, PNG, GIF, WebP) 和 PDF 文件' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadsDir = join(process.cwd(), 'uploads', id);
    
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    const timestamp = Date.now();
    const ext = file.name.split('.').pop();
    const filename = `${timestamp}_${Math.random().toString(36).substring(7)}.${ext}`;
    const filepath = join(uploadsDir, filename);

    await writeFile(filepath, buffer);

    const attachment = await prisma.attachment.create({
      data: {
        category: attachmentCategory,
        filename,
        originalFilename: file.name,
        filepath: `uploads/${id}/${filename}`,
        filesize: file.size,
        mimeType: file.type,
        vehicleId: id,
        uploadedBy: session.user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        vehicleId: id,
        action: 'UPLOAD_ATTACHMENT',
        entityType: 'Attachment',
        entityId: attachment.id,
        changes: {
          category,
          filename: file.name,
        },
      },
    });

    return NextResponse.json(attachment);
  } catch (error) {
    console.error('Upload attachment error:', error);
    return NextResponse.json({ error: '上传失败' }, { status: 500 });
  }
}
