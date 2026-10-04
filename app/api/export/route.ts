import { auth } from '@/lib/auth';
import { buildFleetExportCsv } from '@/lib/export';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const csv = '\uFEFF' + await buildFleetExportCsv(session.user.id, session.user.role);
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `fleet-export-${stamp}.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: '导出失败' }, { status: 500 });
  }
}
